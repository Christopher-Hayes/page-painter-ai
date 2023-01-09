// global CSS
import globalCss from './style.css';
// CSS modules
import styles, { stylesheet } from './style.module.css';

function Greetings() {
  return (
    <>
      <div className={styles.title}>hello</div>
      <p className={styles.desc}>This is a panel. You can drag to move it.</p>
    </>
  );
}

// Convert unselecteElementButton to a react component
const UnselectElementButton = () => {
  return (
    <button
      style={{ display: 'none' }}
      onClick={() => {
        selectedElement = null;
        unselectElementButton.style.display = 'none';
        // remove ai-hovered-element class from all elements
        document.querySelectorAll('.ai-hovered-element').forEach((el) => {
          el.classList.remove('ai-hovered-element');
        });
      }}
    >
      Unselect element
    </button>
  );
};

const MainPanelUI = () => {
  return (
    <div className="style-ai-panel">
      <UnselectElementButton />
    </div>
  );
};

// Let's create a movable panel using @violentmonkey/ui
const panel = VM.getPanel({
  content: <Greetings />,
  theme: 'dark',
  style: [globalCss, stylesheet].join('\n'),
});
panel.wrapper.style.top = '100px';
panel.setMovable(true);
panel.show();
