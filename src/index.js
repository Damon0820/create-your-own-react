/**
 * 自定义jsx转换方法，生成 reactElement，即vnode节点结构
 * 此方法也类似于vue的h()方法
 */
function createElement(type, props, ...children) {
  return {
    type,
    props: {
      ...props,
      children: children.map((child) =>
        typeof child === 'object' ? child : createTextElement(child)
      ),
    },
  };
}

function createTextElement(text) {
  return {
    type: 'TEXT_ELEMENT',
    props: {
      nodeValue: text,
      children: [],
    },
  };
}

/**
 * 将ReactElement渲染为真实dom并挂载到dom树
 * @param {*} element ReactElement
 * @param {*} container 父元素
 */
function createDom(element, container) {
  const { type, props } = element;
  let dom =
    type === 'TEXT_ELEMENT'
      ? document.createTextNode(props.nodeValue)
      : document.createElement(type);
  updateDom(dom, {}, element.props);
  return dom;
}

const isEvent = (key) => key.startsWith('on');
const isProperty = (key) => key !== 'children' && !isEvent(key);
const isNewOrChange = (prevProps, nextProps) => (key) =>
  prevProps[key] !== nextProps[key];
const isGone = (prevProps, nextProps) => (key) => !(key in nextProps);

/**
 * 更新 dom 属性
 */
function updateDom(dom, prevProps, nextProps) {
  // 移除老属性
  Object.keys(prevProps)
    .filter(isProperty)
    .filter(isGone(prevProps, nextProps))
    .forEach((key) => {
      dom[key] = '';
    });

  // 更新新属性
  Object.keys(nextProps)
    .filter(isProperty)
    .filter(isNewOrChange(prevProps, nextProps))
    .forEach((key) => {
      dom[key] = nextProps[key];
    });

  // 移除老事件
  Object.keys(prevProps)
    .filter(isEvent)
    .filter(isGone(prevProps, nextProps))
    .forEach((key) => {
      dom.removeEventListener(key.toLowerCase().slice(2), prevProps[key]);
    });
  // 更新新事件
  Object.keys(nextProps)
    .filter(isEvent)
    .filter(isNewOrChange(prevProps, nextProps))
    .forEach((key) => {
      dom.removeEventListener(key.toLowerCase().slice(2), prevProps[key]);
      dom.addEventListener(key.toLowerCase().slice(2), nextProps[key]);
    });
}

function updateHostComponent(fiber) {
  if (!fiber.dom) {
    fiber.dom = createDom(fiber);
  }
  const elements = fiber.props.children;
  reconcileChildren(fiber, elements);
}

/**
 * 更新组件，触发重新渲染
 */
function updateFunctionComponent(fiber) {
  // re-render component
  wipFiber = fiber;
  hookIndex = 0;
  // fiber.hooks 通过索引排序用于收集所有 hook 对象，所以 hook 调用顺序必须保持稳定。
  wipFiber.hooks = [];
  // 执行函数组件时，会执行 useState, useEffect 等 hook。
  const elements = [fiber.type(fiber.props)];
  reconcileChildren(fiber, elements);
}

/**
 * 实现 useState
 */
function useState(initial) {
  const oldHook =
    wipFiber.alternate &&
    wipFiber.alternate.hooks &&
    wipFiber.alternate.hooks[hookIndex];
  const hook = {
    state: oldHook ? oldHook.state : initial,
    queue: [],
  };

  // 批量执行 actions， state 更新
  const actions = oldHook ? oldHook.queue : [];
  actions.forEach((action) => {
    oldHook.queue.forEach((action) => action(hook.state));
    hook.state = action(hook.state);
  });

  // 闭包函数，用有当前 hook 的引用
  function setState(action) {
    // 加入队列，重渲染的时候再批量执行 actions
    hook.queue.push(action);
    // 触发重新渲染
    wipRoot = nextUnitOfWork = {
      dom: currentRoot.dom,
      props: currentRoot.props,
      alternate: currentRoot,
    };
    deletions = [];
    requestIdleCallback(workLoop);
  }

  wipFiber.hooks.push(hook);
  hookIndex++;

  return [hook.state, setState];
}

/**
 * 执行工作单元
 * 1. 创建dom并挂在到父dom节点
 * 2. 将 ReactElement 子元素生成 fiber 数据结构，并处理父子兄弟 fiber 节点链接关系
 * 3. 返回下一个 fiber 作为执行单元
 *    - 有子返回子(child)
 *    - 若无子返回兄弟(sibling)
 *    - 若无返回父的兄弟即叔叔（uncle）
 */
function performUnitOfWork(fiber) {
  // 1 & 2
  if (fiber.type instanceof Function) {
    updateFunctionComponent(fiber);
  } else {
    updateHostComponent(fiber);
  }
  // 3
  if (fiber.child) {
    return fiber.child;
  }
  let nextFiber = fiber;
  while (nextFiber) {
    if (nextFiber.sibling) {
      return nextFiber.sibling;
    }
    nextFiber = nextFiber.parent;
  }
  return null;
}

/**
 * 当对 fiber 节点的子节点 和 fiber.props.children 对比
 * 比对的过程中，提前一步将子 ReactElement 生成为对应新的 fiber 节点。从而达到同时构建 fiber tree.
 */
function reconcileChildren(wipFiber, elements) {
  let index = 0;
  let prevSibling = null;
  let oldFiber = wipFiber.alternate && wipFiber.alternate.child;
  while (index < elements.length || oldFiber) {
    const element = elements[index];
    let newFiber = null;
    const sameType = oldFiber && element && oldFiber.type === element.type;

    // update
    if (sameType) {
      newFiber = {
        type: element.type,
        props: element.props,
        parent: wipFiber,
        dom: oldFiber.dom,
        alternate: oldFiber,
        effectTag: 'UPDATE',
      };
    }

    // create
    if (element && !sameType) {
      newFiber = {
        type: element.type,
        props: element.props,
        parent: wipFiber,
        dom: null,
        alternate: null,
        effectTag: 'PLACEMENT',
      };
    }

    // delete
    if (oldFiber && !sameType) {
      oldFiber.effectTag = 'DELETION';
      deletions.push(oldFiber);
    }

    if (oldFiber) {
      oldFiber = oldFiber.sibling;
    }

    if (index === 0) {
      wipFiber.child = newFiber;
    } else {
      prevSibling.sibling = newFiber;
    }
    prevSibling = newFiber;
    index++;
  }
}

/**
 * 将 workInProcess root fiber 生成对应的 dom
 */
function commitRoot() {
  deletions.forEach(commitWork);
  commitWork(wipRoot.child);
  currentRoot = wipRoot;
  wipRoot = null;
  deletions = [];
}

/**
 * 将 fiber 生成对应的 dom，并挂载到父节点。递归处理子兄节点
 */
function commitWork(fiber) {
  if (!fiber) {
    return;
  }
  // 找到有真实 dom 的父节点
  let domParentFiber = fiber.parent;
  while (!domParentFiber.dom) {
    domParentFiber = domParentFiber.parent;
  }
  const domParent = domParentFiber.dom;
  if (fiber.effectTag === 'PLACEMENT' && fiber.dom !== null) {
    domParent.appendChild(fiber.dom);
  } else if (fiber.effectTag === 'UPDATE' && fiber.dom !== null) {
    // 更新属性
    updateDom(fiber.dom, fiber.alternate.props, fiber.props);
  } else if (fiber.effectTag === 'DELETION') {
    commitDeletion(fiber, domParent);
  }
  commitWork(fiber.child);
  commitWork(fiber.sibling);
}

function commitDeletion(fiber, domParent) {
  if (fiber.dom) {
    // 找到有真实 dom 的子节点
    domParent.removeChild(fiber.dom);
  } else {
    commitDeletion(fiber.child, domParent);
  }
}

let nextUnitOfWork = null;
let wipRoot = null;
let currentRoot = null;
let deletions = [];
let wipFiber = null;
let hookIndex = null;

function workLoop(deadline) {
  let shouldYield = false;
  while (nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
    shouldYield = deadline.timeRemaining() < 1;
    console.log('nextUnitOfWork', nextUnitOfWork);
  }
  if (nextUnitOfWork) {
    requestIdleCallback(workLoop);
  } else if (!nextUnitOfWork && wipRoot) {
    commitRoot();
  }
}
function render(element, container) {
  // root fiber
  wipRoot = nextUnitOfWork = {
    dom: container,
    props: {
      children: [element],
    },
    alternate: currentRoot,
  };
  requestIdleCallback(workLoop);
}

const MyReact = {
  createElement,
  render,
  useState,
};

// babel-plugin-react-jsx插件提供的注释，可指定自定义jsx转换方法
/** @jsx MyReact.createElement */

function App(props) {
  console.log('App component render');
  const [counter, setCounter] = MyReact.useState(0);
  return (
    <div id="foo">
      {props.name}
      <button onClick={() => setCounter((counter) => ++counter)}>
        {counter}
      </button>
      <a id="bar" href="javascript:void(0);">
        ba;
        <div id="bar1">bar1</div>
        <div id="bar2">bar2</div>
      </a>
      <div id="baz">
        <span id="baz1">baz1</span>
        baz
        <span id="baz2">baz2</span>
      </div>
    </div>
  );
}

const element = <App name="I am a app component" />;

console.log(element);

const container = document.querySelector('#root');
MyReact.render(element, container);
