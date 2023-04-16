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
  let node = document.createTextNode(props.nodeValue);
  if (type !== 'TEXT_ELEMENT') {
    node = document.createElement(type);
    // 设置属性节点
    Object.keys(props).forEach((key) => {
      if (key !== 'children') {
        node[key] = props[key];
      }
    });
  }
  return node;
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
  // 1
  if (!fiber.dom) {
    fiber.dom = createDom(fiber);
  }
  if (fiber.parent) {
    fiber.parent.dom.appendChild(fiber.dom);
  }
  // 2
  const elements = fiber.props.children;
  let index = 0;
  let prevSibling = null;
  while (index < elements.length) {
    const element = elements[index];
    const newFiber = {
      type: element.type,
      props: element.props,
      parent: fiber,
      dom: null,
    };
    if (index === 0) {
      fiber.child = newFiber;
    } else {
      prevSibling.sibling = newFiber;
    }
    prevSibling = newFiber;
    index++;
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

let nextUnitOfWork = null;
function workLoop(deadline) {
  let shouldYield = false;
  while (nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
    shouldYield = deadline.timeRemaining() < 1;
    console.log('nextUnitOfWork', nextUnitOfWork);
  }
  nextUnitOfWork && requestIdleCallback(workLoop);
}

function render(element, container) {
  // root fiber
  nextUnitOfWork = {
    dom: container,
    props: {
      children: [element],
    },
  };
  requestIdleCallback(workLoop);
}

const MyReact = {
  createElement,
  render,
};

// babel-plugin-react-jsx插件提供的注释，可指定自定义jsx转换方法
/** @jsx MyReact.createElement */
const element = (
  <div id="foo">
    <a id="bar" href="javascript;">
      bar
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

console.log(element);

const container = document.querySelector('#root');
MyReact.render(element, container);
