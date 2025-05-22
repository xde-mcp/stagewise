/**
 * Represents a simplified structure of a React Fiber node.
 * React's internal Fiber nodes are more complex.
 */
interface FiberNode {
  tag: number; // Identifies the type of fiber
  type: any; // For HostComponent, it's a string (e.g., 'div'). For Class/Function components, it's the class/function.
  return: FiberNode | null; // Parent fiber in the tree
  _debugOwner?: {
    name: string;
  };
  // Other properties like stateNode, key, memoizedProps exist but are not used here.
}

// Approximate Fiber Tags (numeric values can be checked in React source or DevTools)
// These constants help in identifying the type of a Fiber node.
const FunctionComponent = 0;
const ClassComponent = 1;
const HostComponent = 5; // Represents a DOM element like <div>, <p>, etc.
// const HostRoot = 3; // Represents the root of a React tree.

/**
 * Attempts to find the name of the React component that an HTMLElement belongs to.
 *
 * IMPORTANT: This function relies on React's internal Fiber architecture,
 * which is not a public API and can change between React versions.
 * It is most reliable in development environments.
 *
 * @param element The HTMLElement to inspect.
 * @returns The name of the React component, or null if not found or not applicable.
 */
export function getReactComponentName(
  element: HTMLElement | null,
): string | null {
  if (!element) {
    return null;
  }

  // 1. Find the internal React Fiber node key.
  // React attaches a Fiber node reference to the DOM element.
  // The key usually starts with '__reactFiber$' or '__reactInternalInstance$'.
  const fiberKey = Object.keys(element).find(
    (key) =>
      key.startsWith('__reactFiber$') ||
      key.startsWith('__reactInternalInstance$'),
  );

  if (!fiberKey) {
    console.warn(
      "React internal Fiber key not found on the element. This element might not be managed by React or it's a production build with different internals.",
    );
    return null;
  }

  let currentFiber: FiberNode | null = (element as any)[fiberKey];

  if (!currentFiber) {
    console.warn('Fiber node not found for the element via key:', fiberKey);
    return null;
  }

  // 2. Traverse up the Fiber tree.
  // The Fiber node attached directly to a DOM element is usually a HostComponent.
  // We need to go up to its parent(s) to find the actual user-defined
  // FunctionComponent or ClassComponent that rendered it.
  while (currentFiber) {
    // Check if the current Fiber node represents a user-defined component.
    if (
      currentFiber.tag === ClassComponent ||
      currentFiber.tag === FunctionComponent
    ) {
      const componentType = currentFiber.type;
      if (componentType) {
        // componentType is the class or function itself.
        // .displayName is often set by HOCs or for debugging.
        // .name is the function/class name.
        return (
          componentType.displayName ||
          componentType.name ||
          'AnonymousComponent'
        );
      }
    } else if (currentFiber.tag === HostComponent) {
      return currentFiber._debugOwner?.name
        ? `${currentFiber._debugOwner?.name} (RSC)`
        : null;
    }
    // If it's a HostComponent (e.g., a 'div'), its 'type' is a string.
    // We continue up to find the component that rendered this DOM element.
    currentFiber = currentFiber.return;
  }

  // If the loop completes without finding a suitable component fiber,
  // it means we've reached the top of the fiber tree or the element
  // isn't nested within a recognizable React component structure.
  return null;
}