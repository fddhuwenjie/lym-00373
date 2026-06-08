export class DependencyGraph {
  private adjacencyList: Map<string, Set<string>> = new Map();
  private reverseAdjacencyList: Map<string, Set<string>> = new Map();

  addEdge(from: string, to: string): void {
    if (!this.adjacencyList.has(from)) {
      this.adjacencyList.set(from, new Set());
    }
    this.adjacencyList.get(from)!.add(to);

    if (!this.reverseAdjacencyList.has(to)) {
      this.reverseAdjacencyList.set(to, new Set());
    }
    this.reverseAdjacencyList.get(to)!.add(from);
  }

  removeEdge(from: string, to: string): void {
    if (this.adjacencyList.has(from)) {
      this.adjacencyList.get(from)!.delete(to);
    }
    if (this.reverseAdjacencyList.has(to)) {
      this.reverseAdjacencyList.get(to)!.delete(from);
    }
  }

  removeNode(node: string): void {
    const dependents = this.getDependents(node);
    for (const dependent of dependents) {
      this.removeEdge(node, dependent);
    }

    const dependencies = this.getDependencies(node);
    for (const dependency of dependencies) {
      this.removeEdge(dependency, node);
    }

    this.adjacencyList.delete(node);
    this.reverseAdjacencyList.delete(node);
  }

  updateDependencies(node: string, newDependencies: string[]): void {
    const oldDependencies = this.getDependencies(node);

    for (const dep of oldDependencies) {
      if (!newDependencies.includes(dep)) {
        this.removeEdge(dep, node);
      }
    }

    for (const dep of newDependencies) {
      if (!oldDependencies.includes(dep)) {
        this.addEdge(dep, node);
      }
    }
  }

  getDependencies(node: string): string[] {
    return Array.from(this.reverseAdjacencyList.get(node) || []);
  }

  getDependents(node: string): string[] {
    return Array.from(this.adjacencyList.get(node) || []);
  }

  getAllDependents(node: string): string[] {
    const visited = new Set<string>();
    const result: string[] = [];

    function dfs(current: string, graph: DependencyGraph): void {
      if (visited.has(current)) return;
      visited.add(current);
      
      const dependents = graph.getDependents(current);
      for (const dep of dependents) {
        if (!visited.has(dep)) {
          result.push(dep);
          dfs(dep, graph);
        }
      }
    }

    dfs(node, this);
    return result;
  }

  topologicalSort(): { order: string[]; cycles: string[][] } {
    const inDegree: Map<string, number> = new Map();
    const allNodes = new Set<string>();

    for (const [from, toSet] of this.adjacencyList) {
      allNodes.add(from);
      for (const to of toSet) {
        allNodes.add(to);
      }
    }

    for (const node of allNodes) {
      inDegree.set(node, 0);
    }

    for (const [, toSet] of this.adjacencyList) {
      for (const to of toSet) {
        inDegree.set(to, (inDegree.get(to) || 0) + 1);
      }
    }

    const queue: string[] = [];
    for (const [node, degree] of inDegree) {
      if (degree === 0) {
        queue.push(node);
      }
    }

    const order: string[] = [];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const node = queue.shift()!;
      if (visited.has(node)) continue;
      visited.add(node);
      order.push(node);

      const dependents = this.getDependents(node);
      for (const dep of dependents) {
        const newDegree = (inDegree.get(dep) || 0) - 1;
        inDegree.set(dep, newDegree);
        if (newDegree === 0) {
          queue.push(dep);
        }
      }
    }

    const cycles: string[][] = [];
    const unvisited = Array.from(allNodes).filter(n => !visited.has(n));
    
    if (unvisited.length > 0) {
      const cycleNodes = this.findCycles(unvisited);
      cycles.push(...cycleNodes);
    }

    return { order, cycles };
  }

  private findCycles(nodes: string[]): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const path: string[] = [];

    const dfs = (node: string): boolean => {
      if (recStack.has(node)) {
        const cycleStart = path.indexOf(node);
        if (cycleStart !== -1) {
          cycles.push([...path.slice(cycleStart), node]);
        }
        return true;
      }

      if (visited.has(node)) return false;

      visited.add(node);
      recStack.add(node);
      path.push(node);

      const dependents = this.getDependents(node);
      for (const dep of dependents) {
        if (dfs(dep)) return true;
      }

      recStack.delete(node);
      path.pop();
      return false;
    };

    for (const node of nodes) {
      if (!visited.has(node)) {
        dfs(node);
      }
    }

    return cycles;
  }

  clear(): void {
    this.adjacencyList.clear();
    this.reverseAdjacencyList.clear();
  }

  hasNode(node: string): boolean {
    return this.adjacencyList.has(node) || this.reverseAdjacencyList.has(node);
  }

  getNodes(): string[] {
    const nodes = new Set<string>();
    for (const [from, toSet] of this.adjacencyList) {
      nodes.add(from);
      for (const to of toSet) {
        nodes.add(to);
      }
    }
    return Array.from(nodes);
  }
}
