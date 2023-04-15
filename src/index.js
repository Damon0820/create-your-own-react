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
function render(element, container) {
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
    // 递归创建子节点
    props.children.forEach((child) => render(child, node));
  }
  // 后序遍历，最后将整个dom树挂在到文档
  container.appendChild(node);
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
