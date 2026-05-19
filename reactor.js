export function widget(type, props, ...children) {
  const safeProps = props || {};
  return {
    type,
    props: {
      ...safeProps,
      children: children.flat().filter(c => c != null && c !== false)
    },
    key: safeProps.key ?? null,
    el: null 
  };
}

export function createComponent({ state, render, container }) {
  let currentState = { ...state };
  let currentDOM = null;
  let vdom = null;
  let isPending = false;
  function queueUpdate() {
    if (!isPending) {
      isPending = true;
      queueMicrotask(() => {
        isPending = false;
        const nextVDOM = render(currentState, setState);
        currentDOM = reconcile(container, currentDOM, vdom, nextVDOM);
        vdom = nextVDOM;
      });
    }
  }
  function setState(newState) {
    currentState = typeof newState === 'function' ? newState(currentState) : { ...currentState, ...newState };
    queueUpdate();
  }
  const nextVDOM = render(currentState, setState);
  currentDOM = reconcile(container, currentDOM, vdom, nextVDOM);
  vdom = nextVDOM;
}

function reconcile(parent, dom, oldVNode, newVNode) {
  if (newVNode == null) {
    if (dom) dom.remove();
    return null;
  }
  if (typeof newVNode !== 'object') {
    if (typeof oldVNode !== 'object' && dom) {
      if (dom.nodeValue !== String(newVNode)) {
        dom.nodeValue = String(newVNode);
      }
      return dom;
    }
    const newDom = document.createTextNode(String(newVNode));
    if (dom) parent.replaceChild(newDom, dom);
    else parent.appendChild(newDom);
    return newDom;
  }
  if (!oldVNode || oldVNode.type !== newVNode.type) {
    const newDom = document.createElement(newVNode.type);
    newVNode.el = newDom;
    updateProps(newDom, {}, newVNode.props);
    newVNode.props.children.forEach(child => reconcile(newDom, null, null, child));    
    if (dom) parent.replaceChild(newDom, dom);
    else parent.appendChild(newDom);
    return newDom;
  }
  newVNode.el = dom;
  updateProps(dom, oldVNode.props || {}, newVNode.props);   
  const oldChildren = oldVNode.props.children || [];
  const newChildren = newVNode.props.children || [];  
  const oldMatchMap = new Map();
  const originalDomNodes = Array.from(dom.childNodes);
  oldChildren.forEach((child, idx) => {
    const isObj = child && typeof child === 'object';
    const key = isObj && child.key != null ? `k_${child.key}` : `i_${typeof child}_${idx}`;
    const actualDomNode = isObj ? child.el : originalDomNodes[idx];    
    oldMatchMap.set(key, { child, node: actualDomNode });
  });
  let lastPlacedNode = null;
  newChildren.forEach((newChild, idx) => {
    const isObj = newChild && typeof newChild === 'object';
    const key = isObj && newChild.key != null ? `k_${newChild.key}` : `i_${typeof newChild}_${idx}`;
    const matched = oldMatchMap.get(key);
    let childDom = null;

    if (matched) {
      childDom = reconcile(dom, matched.node, matched.child, newChild);
      oldMatchMap.delete(key);
    } else {
      childDom = reconcile(dom, null, null, newChild);
    }
    if (childDom) {
      if (isObj) {
        newChild.el = childDom;
      }
      const expectedNext = lastPlacedNode ? lastPlacedNode.nextSibling : dom.firstChild;
      if (childDom !== expectedNext) {
        if (lastPlacedNode) {
          lastPlacedNode.after(childDom);
        } else {
          dom.prepend(childDom);
        }
      }
      lastPlacedNode = childDom;
    }
  });
  oldMatchMap.forEach(({ node }) => {
    if (node) node.remove();
  });

  return dom;
}

function updateProps(dom, oldProps, newProps) {
  for (const name in oldProps) {
    if (name !== 'children' && !(name in newProps)) {
      if (name.startsWith('on')) {
        dom.removeEventListener(name.toLowerCase().substring(2), oldProps[name]);
      } else if (name === 'style') {
        dom.removeAttribute('style');
      } else {
        dom[name] = '';
      }
    }
  }
  for (const name in newProps) {
    if (name !== 'children' && oldProps[name] !== newProps[name]) {
      if (name.startsWith('on')) {
        const eventName = name.toLowerCase().substring(2);
        if (oldProps[name]) dom.removeEventListener(eventName, oldProps[name]);
        dom.addEventListener(eventName, newProps[name]);
      } else if (name === 'style' && typeof newProps[name] === 'object') {
        const oldStyle = oldProps[name] || {};
        for (const styleKey in oldStyle) {
          if (!(styleKey in newProps[name])) {
            dom.style[styleKey] = '';
          }
        }
        Object.assign(dom.style, newProps[name]);
      } else {
        dom[name] = newProps[name] == null ? '' : newProps[name];
      }
    }
  }
}