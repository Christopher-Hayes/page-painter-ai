import { Panel, UnselectElementButton, PickElementButton } from './app';

const k = GM_getValue('openai_key', null);

if (!k || k === 'insert_key_here') {
  console.error('Please set your OpenAI API key in the script settings');
  GM_setValue('openai_key', 'insert_key_here');
}

let mode = 'css';
let selectedElement = null;
let selectedElementCSS = null;
let lastHoveredElement = null;

function startPickElement() {
  selectedElement = null;
  selectedElementCSS = null;

  // remove the .ai-hovered-element class from all elements
  document.querySelectorAll('.ai-hovered-element').forEach((element) => {
    element.classList.remove('ai-hovered-element');
  });

  document.addEventListener('mousemove', onMouseMove);

  setTimeout(() => {
    document.addEventListener('click', onMouseClick);
    // prevent links from being clicked
    document.querySelectorAll('a, button').forEach((link) => {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      link.addEventListener('mousedown', (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      link.addEventListener('mouseup', (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
    });
  }, 500);
}

function onMouseMove(event) {
  const element = document.elementFromPoint(event.clientX, event.clientY);

  // Check element exists and the point event.clientX and event.clientY is not contained inside the panel
  if (
    element &&
    !Panel.wrapper.contains(element) &&
    element !== Panel.wrapper
  ) {
    // remove the style class from the last hovered element
    if (lastHoveredElement) {
      lastHoveredElement.classList.remove('ai-hovered-element');
    }
    // add the style class to the current hovered element
    element.classList.add('ai-hovered-element');

    // update the last hovered element
    lastHoveredElement = element;
  }
}

function getElement(event) {
  const element = document.elementFromPoint(event.clientX, event.clientY);

  // Check element exists and the point event.clientX and event.clientY is not contained inside the panel
  if (
    element &&
    !Panel.wrapper.contains(element) &&
    element !== Panel.wrapper
  ) {
    return element;
  }
}

function onMouseClick(event) {
  event.stopPropagation();
  event.preventDefault();

  // if element doesn't have a css class, go up the tree until you find one, up to 5 levels
  // count the classes that are not ai-hovered-element
  /*
  let elementToSelect = getElement(event);
  let level = 0;
  let lastElement = elementToSelect;
  while (((elementToSelect.classList.contains('ai-hovered-element') && elementToSelect.classList.length < 2) || (!elementToSelect.classList.contains('ai-hovered-element') && elementToSelect.classList.length < 1)) && elementToSelect && level < 5) {
    console.log('not enough classes:', elementToSelect);
    lastElement = elementToSelect;
    elementToSelect = elementToSelect.parentElement;
    level++;
  }
  console.log('elementToSelect:', elementToSelect);
  const element = elementToSelect || lastElement;
  */

  // If the element doesn't have an id or class (other than ai-hovered-element), give it a unique id
  const element = getElement(event);
  if (
    element &&
    !element.id /* &&
    !element.classList.contains("ai-hovered-element")
    */
  ) {
    element.id = `ai-hovered-element-${Math.random()
      .toString(36)
      .substring(2, 15)}`;
  }

  if (element) {
    console.log('selected element:', element);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('click', onMouseClick);
    selectedElement = element;
    UnselectElementButton.style.display = 'block';
    selectedElementCSS = selectedElement.style.cssText;
    aiResult.innerText = selectedElementCSS;
  }
}

async function makeGPT3Request(elementHTML, description) {
  // Scrub the "ai-hovered-element" class from the HTML
  elementHTML = elementHTML.replace(/ai-hovered-element/g, '');
  // Minify the HTML to only have html tags, text, and "class"
  elementHTML = elementHTML.replace(/<[^>]+>/g, (match) => {
    // If it's a tag, just keep the tag name
    // But leave the class attribute
    if (match.startsWith('<')) {
      const tag = match.match(/<[^ >]+/)[0];
      const classAttribute = match.match(/class="[^"]+"/);
      if (classAttribute) {
        return `${tag} ${classAttribute[0]}>`;
      }
      return `${tag}>`;
    }

    return match;
  });
  // minify unnecessary whitespace
  elementHTML = elementHTML.replace(/\s+/g, ' ');
  console.log('elementHTML', elementHTML);

  const url = 'https://api.openai.com/v1/completions';
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${k}`,
  };
  let prompt = '';
  let stop = '';
  switch (mode) {
    case 'html':
      prompt = `Based on the description "${description}", give the HTML to make that change to the following HTML: \n${elementHTML}\n`;
      stop = '';
      break;
    default:
    case 'css':
      prompt = `Based on the description "${description}", give the CSS stylesheet to make that change to the following HTML: \n${elementHTML}\n<style>`;
      stop = '</style>';
      break;
    case 'tailwind':
      prompt = `Based on the description "${description}", give the Tailwind CSS to make that change to the following HTML: \n${elementHTML}\n<div class="`;
      stop = '">';
      break;
    case 'script':
      prompt = `Based on the description "${description}", give the JavaScript to make that change to the following HTML: \n${elementHTML}\n<script>`;
      stop = '</script>';
      break;
  }

  const body = {
    model: 'text-davinci-003',
    prompt,
    max_tokens: 2000,
  } as {
    model: string;
    prompt: string;
    max_tokens: number;
    stop?: string;
  };

  if (stop) {
    // add property stop to body
    body.stop = stop;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const data = await response.json();
  let text = data.choices[0].text;
  // if it starts with a newline, remove it
  if (text.startsWith('\n')) {
    text = text.substring(1);
  }

  const showTailwind = () => {
    // if it has " style=" then replace that with a newline
    text = text.replace(/" style="/g, '\nInline CSS styles:');
    const newStyle = document.createElement('style');
    newStyle.innerText = text;
    document.head.appendChild(newStyle);
  };

  const showCSS = () => {
    // remove html tags
    text = text.replace(/</g, '<').replace(/>/g, '>');
    text = text.replace(/<[^>]*>/g, '');
    // remove <br> tags
    text = text.replaceAll('<br>', '');
    console.log('scrubbed css', text);
  };

  switch (mode) {
    case 'tailwind':
      console.log('tailwind', text);
      showTailwind();
      return text;
    case 'html':
      console.log('html', text);
      return text;
    case 'script':
      console.log('script', text);
      return text;
    default:
    case 'css':
      console.log('css', text);
      showCSS();
      return text;
  }
}

async function applyStyles() {
  if (selectedElement) {
    // set the button to "Thinking..."
    applyButton.innerText = 'Thinking...';

    const response = await makeGPT3Request(
      selectedElement.outerHTML,
      userPrompt.value
    );

    if (mode === 'css') {
      const newStyle = document.createElement('style');
      newStyle.innerText = response;
      document.head.appendChild(newStyle);

      selectedElementCSS = response;
      aiResult.innerText = response;
    } else if (mode === 'tailwind') {
      aiResult.innerText = response;
    } else if (mode === 'html') {
      if (selectedElement.parentElement) {
        selectedElement.parentElement.innerHTML = response;
      } else {
        selectedElement.innerHTML = response;
      }

      aiResult.innerText = response;
    } else if (mode === 'script') {
      const script = document.createElement('script');
      // put the script response inside a self-executing function
      // so that it doesn't pollute the global scope
      script.innerHTML = `(function() {
  ${response}
})()`;
      document.head.appendChild(script);
      aiResult.innerText = response;
    }

    // reset the button to "Run Update"
    applyButton.innerText = 'Run Update';
    // remove the .ai-hovered-element class from all elements
    document.querySelectorAll('.ai-hovered-element').forEach((element) => {
      element.classList.remove('ai-hovered-element');
    });
    lastHoveredElement = null;
  }
}

function copyResult() {
  if (selectedElement) {
    // Put the aiResult text into the clipboard
    // Ask for permission to access the clipboard
    navigator.permissions
      .query({ name: 'clipboard-write' } as any)
      .then((result) => {
        if (result.state == 'granted' || result.state == 'prompt') {
          navigator.clipboard.writeText(aiResult.innerText).then(
            function () {
              // Success
              // briefly change the button text to "Copied!"
              const originalText = copyButton.innerText;
              copyButton.innerText = 'Copied!';
              // make background a vibrant green shade
              copyButton.style.backgroundColor = '#3b9e4d';
              setTimeout(() => {
                copyButton.innerText = originalText;
                copyButton.style.backgroundColor = '';
              }, 2000);
            },
            function () {
              // Error
              // briefly change the button text to "Copy Failed"
              const originalText = copyButton.innerText;
              copyButton.innerText = 'Copy Failed';
              // make background a muted red shade
              copyButton.style.backgroundColor = '#f5c6cb';
              setTimeout(() => {
                copyButton.innerText = originalText;
                copyButton.style.backgroundColor = '';
              }, 3000);
            }
          );
        }
      });
  }
}

function saveStyles() {
  if (selectedElement) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(
      new Blob([selectedElementCSS], { type: 'text/plain' })
    );
    a.setAttribute('download', 'styles.css');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

// Add drag bar to the top of the panel for dragging the panel around
// in the drag bar add an x button to close the panel at the top right
const dragBar = document.createElement('div');
dragBar.classList.add('drag-bar');

const closeButton = document.createElement('button');
closeButton.innerText = 'X';
closeButton.classList.add('close-button');
closeButton.addEventListener('click', () => {
  panel.style.display = 'none';
});

dragBar.appendChild(closeButton);
panel.appendChild(dragBar);

// Add drag functionality to the panel
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let panelStartX = 0;
let panelStartY = 0;

dragBar.addEventListener('mousedown', (e) => {
  isDragging = true;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  panelStartX = panel.offsetLeft;
  panelStartY = panel.offsetTop;
});

document.addEventListener('mousemove', (e) => {
  if (isDragging) {
    panel.style.left = `${panelStartX + e.clientX - dragStartX}px`;
    panel.style.top = `${panelStartY + e.clientY - dragStartY}px`;
    // prevent the panel from being dragged outside the window
    if (panel.offsetLeft < 0) {
      panel.style.left = '0';
    }
    if (panel.offsetTop < 0) {
      panel.style.top = '0';
    }
    if (panel.offsetLeft + panel.offsetWidth > window.innerWidth) {
      panel.style.left = `${window.innerWidth - panel.offsetWidth}px`;
    }
    if (panel.offsetTop + panel.offsetHeight > window.innerHeight) {
      panel.style.top = `${window.innerHeight - panel.offsetHeight}px`;
    }
  }
});

document.addEventListener('mouseup', () => {
  isDragging = false;
});

// Add button to the bottom right of the panel to resize the panel by dragging
const resizeButton = document.createElement('button');
resizeButton.innerText = 'Resize';
resizeButton.classList.add('resize-button');
panel.appendChild(resizeButton);

// Add resize functionality to the panel
let isResizing = false;
let resizeStartX = 0;
let resizeStartY = 0;
let panelStartWidth = 0;
let panelStartHeight = 0;

resizeButton.addEventListener('mousedown', (e) => {
  if (isResizing) {
    isResizing = false;
    panel.style.width = `${panel.offsetWidth}px`;
    panel.style.minHeight = `${panel.offsetHeight}px`;
    panel.style.height = 'auto';
    return;
  }
  isResizing = true;
  resizeStartX = e.clientX;
  resizeStartY = e.clientY;
  panelStartWidth = panel.offsetWidth;
  panelStartHeight = panel.offsetHeight;
  panel.style.height = `${panel.offsetHeight}px`;
  panel.style.minWidth = 'auto';
  panel.style.minHeight = 'auto';
});

document.addEventListener('mousemove', (e) => {
  if (isResizing) {
    panel.style.width = `${panelStartWidth + e.clientX - resizeStartX}px`;
    panel.style.height = `${panelStartHeight + e.clientY - resizeStartY}px`;
  }
});

document.addEventListener('mouseup', () => {
  panel.style.width = `${panel.offsetWidth}px`;
  panel.style.minHeight = `${panel.offsetHeight}px`;
  panel.style.height = 'auto';
  isResizing = false;
});

// on mode change, update the "mode" variable
modeSelector.addEventListener('change', (e) => {
  mode = (e.target as any).value;

  // update the placeholder text in the input
  if (mode === 'css') {
    userPrompt.placeholder = 'Describe the style updates you want';
  } else if (mode === 'tailwind') {
    userPrompt.placeholder = 'Describe the style updates you want';
  } else if (mode === 'html') {
    userPrompt.placeholder = 'Describe the change the HTML you want';
  } else if (mode === 'script') {
    userPrompt.placeholder = 'Describe the script you want to run';
  }
});

// Function that accepts an HTML element and returns a unique selector for that element
/*
function getSelector(el) {
  if (el.id) {
    return `#${el.id}`;
  }
  if (el.classList.length > 0) {
    // Ignore .ai-hovered-element class
    const classes = Array.from(el.classList).filter(
      (c) => c !== 'ai-hovered-element'
    );
    if (classes.length > 0) {
      // check if there are multiple elements with the same class
      const sameClassElements = Array.from(
        document.getElementsByClassName(classes[0] as string)
      );
      if (sameClassElements.length > 1) {
        // if there are multiple elements with the same class, add the element index to the selector
        const children = Array.from(el.parentElement.children);
        const index = children.indexOf(el);
        return `${getSelector(el.parentElement)} > :nth-child(${index + 1})`;
      }

      return `.${classes.join('.')}`;
    }
  }

  const parent = el.parentElement;
  if (parent) {
    const children = Array.from(parent.children);
    const index = children.indexOf(el);
    return `${getSelector(parent)} > :nth-child(${index + 1})`;
  }
  return '';
}
*/

// Add another text input that allows the user to specify a tweak they want to make on the elementStyles element
// Another button is also needed to "run" the tweak
// The tweak should be applied to the elementStyles element
// Add label "Run tweak on result"
const tweakLabel = document.createElement('label');
tweakLabel.classList.add('tweak-label');
tweakLabel.innerText = 'Tweak the AI result';
panel.appendChild(tweakLabel);

const tweakUserInput = document.createElement('input');
tweakUserInput.classList.add('tweak-input');
tweakUserInput.placeholder = 'Make the blue 20% less saturated..';
panel.appendChild(tweakUserInput);

const tweakButton = document.createElement('button');
tweakButton.innerText = 'Run Tweak';
panel.appendChild(tweakButton);

// when the tweak button is clicked, run a gpt-3 query to update the elementStyles text according to the tweak
// use fetch to send a POST request to the the openai api
async function runTweak() {
  const tweak = tweakUserInput.value;
  if (tweak) {
    tweakButton.innerText = 'Thinking...';

    let elementHTML = selectedElement.outerHTML
      ? selectedElement.outerHTML
      : selectedElement.innerHTML;
    // Scrub the "ai-hovered-element" class from the HTML
    elementHTML = elementHTML.replace(/ai-hovered-element/g, '');
    // Minify the HTML to only have html tags, text, and "class"
    elementHTML = elementHTML.replace(/<[^>]+>/g, (match) => {
      // If it's a tag, just keep the tag name
      // But leave the class attribute
      if (match.startsWith('<')) {
        const tag = match.match(/<[^ >]+/)[0];
        const classAttribute = match.match(/class="[^"]+"/);
        if (classAttribute) {
          return `${tag} ${classAttribute[0]}>`;
        }
        return `${tag}>`;
      }

      return match;
    });
    // minify unnecessary whitespace
    elementHTML = elementHTML.replace(/\s+/g, ' ');

    const response = await fetch('https://api.openai.com/v1/edits', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${k}`,
      },
      body: JSON.stringify({
        input: aiResult.innerText,
        instruction: `Write new code that does "${tweak}" on the HTML element:\n${elementHTML}\n${
          mode === 'css'
            ? '<style>'
            : mode === 'script'
            ? '<script>'
            : mode === 'html'
            ? '<div>'
            : '<div class="'
        }`,
        model: 'code-davinci-edit-001',
      }),
    });
    const data = await response.json();
    let newCode = data.choices[0].text;
    // if the newCode ends in </style> or </script>, remove it
    if (newCode.endsWith('</style>') || newCode.endsWith('</script>')) {
      newCode = newCode.slice(0, -8);
    }
    aiResult.innerText = newCode;

    const setCSS = () => {
      const newStyle = document.createElement('style');
      newStyle.innerText = newCode;
      document.head.appendChild(newStyle);
    };

    const setHTML = () => {
      if (selectedElement.parentElement) {
        selectedElement.parentElement.innerHTML = newCode;
      } else {
        selectedElement.innerHTML = newCode;
      }
    };

    switch (mode) {
      case 'css':
        // add another style tag to the head with the new code
        setCSS();
        break;
      case 'html':
        // update the innerHTML of the elementStyles element
        setHTML();
        break;
      case 'script':
        // run the new code
        eval(newCode);
        break;
    }

    tweakButton.innerText = 'Run Tweak';
  }
}
tweakButton.addEventListener('click', async () => {
  runTweak();
});
tweakUserInput.addEventListener('keyup', (e) => {
  if (e.key === 'Enter') {
    runTweak();
  }
});

// Add label for "Utilities"
const utilitiesLabel = document.createElement('label');
utilitiesLabel.classList.add('utilities-label');
utilitiesLabel.innerText = 'Utilities';
panel.appendChild(utilitiesLabel);
// Add a button that converts html elements with css classes to inline styles only
// Then copies the html to the clipboard
const getHTML = document.createElement('button');
getHTML.innerText = 'Get HTML of Element';
panel.appendChild(getHTML);

// List out most commonly used styles, ignoring styles that are the same as the default styles and are rarely used
const mostUsedStyles = [
  'color',
  'background',
  'background-color',
  'font-size',
  'font-weight',
  'font-family',
  'text-align',
  'text-decoration',
  'border',
  'border-top',
  'border-left',
  'border-right',
  'border-bottom',
  'border-radius',
  'border-top-left-radius',
  'border-top-right-radius',
  'border-bottom-left-radius',
  'border-bottom-right-radius',
  'border-color',
  'border-top-color',
  'border-left-color',
  'border-right-color',
  'border-bottom-color',
  'border-style',
  'border-top-style',
  'border-left-style',
  'border-right-style',
  'border-bottom-style',
  'border-width',
  'border-top-width',
  'border-left-width',
  'border-right-width',
  'border-bottom-width',
  'padding',
  'padding-top',
  'padding-left',
  'padding-right',
  'padding-bottom',
  'margin',
  'margin-top',
  'margin-left',
  'margin-right',
  'margin-bottom',
  'width',
  'height',
  'display',
  'flex',
  'flex-direction',
  'flex-wrap',
  'justify-content',
  'align-items',
  'align-content',
  'order',
  'grid',
  'grid-template-columns',
  'grid-template-rows',
  'grid-template-areas',
  'grid-auto-columns',
  'grid-auto-rows',
  'grid-auto-flow',
  'grid-column',
  'grid-row',
  'grid-column-start',
  'grid-column-end',
  'grid-row-start',
  'grid-row-end',
  'grid-area',
  'grid-gap',
  'grid-column-gap',
  'grid-row-gap',
  'justify-items',
  'justify-self',
  'align-items',
  'align-self',
  'place-items',
  'place-content',
  'gap',
  'column-gap',
  'row-gap',
  'position',
  'top',
  'left',
  'right',
  'bottom',
  'z-index',
  'box-shadow',
  'opacity',
  'transform',
  'transition',
  'cursor',
  'overflow',
  'overflow-x',
  'overflow-y',
  'white-space',
  'line-height',
  'letter-spacing',
  'word-spacing',
  'text-transform',
  'text-indent',
  'text-shadow',
  'vertical-align',
  'direction',
  'list-style',
  'table-layout',
  'border-collapse',
  'border-spacing',
  'empty-cells',
  'content',
  'outline',
  'outline-offset',
  'box-sizing',
  'max-width',
  'max-height',
  'min-width',
  'min-height',
  'clip',
  'clear',
  'float',
  'font-style',
];

// default values
const defaultValues = [
  'auto',
  'none',
  'normal',
  'inherit',
  'initial',
  'unset',
  'transparent',
  '0',
  '0px',
  '0%',
  '0em',
  '0rem',
  '0pt',
  '0vh',
  '0vw',
  '0vmin',
  '0vmax',
  '0deg',
  '0turn',
  '0rad',
  '0s',
  '0ms',
  '0fr',
  '0px 0px',
  '0px 0px 0px 0px',
  '0px 0px 0px 0px / 0px 0px 0px 0px',
  'rgba(0, 0, 0, 0)',
];

// Properties that can be inherited
const inheritableProperties = [
  'color',
  'background',
  'background-color',
  'font-size',
  'font-weight',
  'font-family',
  'text-align',
  'text-decoration',
];

getHTML.addEventListener('click', async () => {
  if (!selectedElement) {
    alert('Please select an element first');
    return;
  }
  const parentElement = selectedElement;

  // If the element doesn't have an id or class (other than ai-hovered-element), give it a unique id
  if (!parentElement.id) {
    parentElement.id = `ai-hovered-element-${Math.random()
      .toString(36)
      .substring(2, 15)}`;
  }

  const elements = Array.from(
    document.querySelectorAll(`#${parentElement.id} *`)
  );
  // prepend the parent element to the beginning of the elements array
  elements.unshift(parentElement);

  // remove the ai-hovered-element class from the parent element
  parentElement.classList.remove('ai-hovered-element');
  // Wait for the next frame to make sure the styles are updated
  await new Promise((resolve) => requestAnimationFrame(resolve));

  for (const el of elements) {
    let inlineStyles = '';
    const styles = getComputedStyle(el);

    // for (const [style, value] of Object.entries(styles)) {
    for (let i = 0; i < styles.length; i++) {
      const style = styles[i];

      let styleName = style;
      // Convert to skewer case
      if (/[A-Z]/.test(styleName)) {
        // convert to skewer case
        styleName = styleName.replace(
          /([A-Z])/g,
          (g) => `-${g[0].toLowerCase()}`
        );
        console.log(style, '->', styleName);
      }

      const value = styles.getPropertyValue(styleName);

      // Ignore some troublesome styles on the parent element
      if (el === parentElement && ['width', 'height'].includes(styleName)) {
        console.log('skipping parent style', styleName, value);
        continue;
      }

      // If the value is a default value, skip it
      if (defaultValues.includes(value)) {
        console.log('skipping default value', styleName, value);
        continue;
      }

      // get the style value and add it to the html string
      if (mostUsedStyles.includes(styleName)) {
        if (styleName.includes('margin')) {
          console.log('including margin', styleName, value);
        }
        inlineStyles += `${styleName}:${value};`;
      } else {
        console.log('skipping uncommon style', styleName, value);
      }
    }

    // Separately handle margin and padding
    // const margin = el.currentStyle ? el.currentStyle["margin"] : styles.margin;
    // const padding = el.currentStyle ? el.currentStyle["padding"] : styles.padding;
    // if (margin !== defaultStyles.margin) {
    //   inlineStyles += `margin:${margin};`;
    // }
    // if (padding !== defaultStyles.padding) {
    //   inlineStyles += `padding:${padding};`;
    // }

    // add the inline styles to the element
    el.setAttribute('style', inlineStyles);
  }

  // Remove the class attribute from all elements
  for (const el of elements) {
    el.removeAttribute('class');
  }

  // remove the id from the parent element if it was added
  if (parentElement.id.startsWith('ai-hovered-element')) {
    parentElement.removeAttribute('id');
  }

  // Go through the HTML tree of the parent element
  // Start at the parent element and go down the tree
  // If the child has the same style value for a style as the parent, remove the style from the child
  // This will make the HTML more readable
  const removeDuplicateStyles = (el) => {
    const styles = getComputedStyle(el);
    for (let i = 0; i < styles.length; i++) {
      const style = styles[i];
      const value = styles.getPropertyValue(style);

      // If the child has the same style value as the parent, remove the style from the child
      if (
        inheritableProperties.includes(style) &&
        el.parentElement.style[style] === value
      ) {
        el.style[style] = '';
      }
    }

    // Recursively go through the children
    for (const child of el.children) {
      removeDuplicateStyles(child);
    }
  };

  removeDuplicateStyles(parentElement);

  // put the html in the aiResult element
  aiResult.innerText = parentElement.outerHTML
    ? parentElement.outerHTML
    : parentElement.innerHTML;

  // Add the ai-hovered-element class back to the parent element
  parentElement.classList.add('ai-hovered-element');

  // copy to the clipboard after a delay to make the UI less jerky
  await setTimeout(() => {
    copyResult();
  }, 500);
});
