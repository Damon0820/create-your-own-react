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

const Didact = {
  createElement,
};

// babel-plugin-react-jsx插件提供的注释，可指定自定义jsx转换方法
/** @jsx Didact.createElement */
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
