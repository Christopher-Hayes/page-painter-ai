// global CSS
import globalCss from './style.css';
// CSS modules
// import styles, { stylesheet } from './style.module.css';

function Greetings() {
  return (
    <>
      <div className={styles.title}>hello</div>
      <p className={styles.desc}>This is a panel. You can drag to move it.</p>
    </>
  );
}

// Build button
const Button = ({ onClick, text, style = {}, className = '' }) => {
  return () => (
    <button
      onClick={() => {
        onClick();
      }}
      style={style}
      className={className}
    >
      {text}
    </button>
  );
};

// Build label
const Label = ({ text, className = '' }) => {
  return () => <h3 className={className}>{text}</h3>;
};

// Build mode selector
const ModeSelector = () => {
  return (
    <select className="mode-selector">
      <option value="css">CSS</option>
      <option value="tailwind">Tailwind</option>
      <option value="html">HTML</option>
      <option value="script">Script</option>
    </select>
  );
};

const UnselectElementButton = Button({
  onClick: () => {
    selectedElement = null;
    unselectElementButton.style.display = 'none';
    // remove ai-hovered-element class from all elements
    document.querySelectorAll('.ai-hovered-element').forEach((el) => {
      el.classList.remove('ai-hovered-element');
    });
  },
  text: 'Unselect element',
  style: { display: 'none' },
});
const PickElementButton = Button({
  onClick: () => {
    startPickElement();
  },
  text: 'Pick element',
});

const UserPrompt = () => {
  return (
    <input
      type="text"
      placeholder="Make the background blue.."
      className="prompt"
      onKeyUp={(e) => {
        if (e.key === 'Enter') {
          applyStyles();
        }
      }}
    />
  );
};

const RunButton = Button({
  onClick: () => {
    applyStyles();
  },
  text: 'Run Update',
});

// Build header
const Header = () => {
  return (
    <header className="style-ai-header">
      <PickElementButton />
      <UnselectElementButton />
      <UserPrompt />
      <ModeSelector />
      <RunButton />
    </header>
  );
};

// Build result section
const ResultSection = () => {
  const ResultLabel = Label({
    text: 'Code from AI:',
    className: 'ai-result-label',
  });

  const Result = () => {
    return <div className="ai-result"></div>;
  };

  const CopyButton = Button({
    onClick: () => {
      copyResult();
    },
    text: 'Copy',
  });

  const SaveButton = Button({
    onClick: () => {
      saveStyles();
    },
    text: 'Save',
  });

  return (
    <div className="ai-result-section">
      <ResultLabel />
      <Result />
      <CopyButton />
      <SaveButton />
    </div>
  );
};

const MainPanelUI = () => {
  return (
    <div className="style-ai-panel">
      <Header />
      <ResultSection />
    </div>
  );
};

// Let's create a movable panel using @violentmonkey/ui
const Panel = VM.getPanel({
  content: <MainPanelUI />,
  style: [globalCss].join('\n'),
});
Panel.wrapper.style.top = '100px';
// panel.setMovable(true);
Panel.show();

export { Panel, UnselectElementButton, PickElementButton };
