export const SCORM_API_JS = `/* Minimal SCORM 1.2 API adapter. No external dependencies (SCO iframes commonly block outbound network). */
(function (window) {
  "use strict";

  function findAPI(win) {
    let tries = 0;
    while (win.API == null && win.parent != null && win.parent !== win) {
      tries += 1;
      if (tries > 500) return null;
      win = win.parent;
    }
    return win.API || null;
  }

  let api = null;
  let initialized = false;

  const SCORM = {
    init() {
      api = findAPI(window) || (window.opener && findAPI(window.opener)) || null;
      if (!api) {
        initialized = false;
        return false;
      }
      const result = api.LMSInitialize("");
      initialized = result === "true" || result === true;
      return initialized;
    },
    getValue(key) {
      if (!initialized) return "";
      return api.LMSGetValue(key);
    },
    setValue(key, value) {
      if (!initialized) return;
      api.LMSSetValue(key, value);
    },
    commit() {
      if (!initialized) return;
      api.LMSCommit("");
    },
    setProgress(slideIndex) {
      this.setValue("cmi.core.lesson_location", String(slideIndex));
      this.commit();
    },
    setCompleted() {
      this.setValue("cmi.core.lesson_status", "completed");
      this.commit();
    },
    getResumeLocation() {
      const loc = this.getValue("cmi.core.lesson_location");
      const parsed = parseInt(loc, 10);
      return Number.isFinite(parsed) ? parsed : 0;
    },
    finish() {
      if (!initialized) return;
      api.LMSFinish("");
    },
  };

  window.SCORM = SCORM;
})(window);
`;

export const VIEWER_CSS = `* {
  box-sizing: border-box;
}
html,
body {
  margin: 0;
  padding: 0;
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: #f7f7f8;
  color: #1a1a1a;
}
#app {
  display: flex;
  flex-direction: column;
  height: 100%;
}
header {
  padding: 16px 24px;
  background: #ffffff;
  border-bottom: 1px solid #e2e2e2;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
header h1 {
  font-size: 16px;
  margin: 0;
}
#progress-track {
  flex: 1;
  height: 6px;
  background: #e2e2e2;
  border-radius: 3px;
  margin: 0 16px;
  overflow: hidden;
}
#progress-fill {
  height: 100%;
  background: #2563eb;
  width: 0%;
  transition: width 0.2s ease;
}
main {
  flex: 1;
  overflow-y: auto;
  padding: 32px 48px;
  max-width: 900px;
  margin: 0 auto;
  width: 100%;
}
#module-label {
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #6b7280;
  margin-bottom: 4px;
}
#slide-title {
  font-size: 30px;
  margin: 0 0 20px;
}
#slide-image {
  max-width: 100%;
  border-radius: 8px;
  margin-bottom: 20px;
  display: block;
}
#slide-bullets {
  font-size: 17px;
  line-height: 1.6;
  padding-left: 24px;
}
#slide-bullets li {
  margin-bottom: 10px;
}
#slide-example {
  margin-top: 24px;
  padding: 16px 20px;
  background: #eef2ff;
  border-left: 4px solid #2563eb;
  border-radius: 4px;
  font-style: italic;
}
footer {
  padding: 16px 24px;
  background: #ffffff;
  border-top: 1px solid #e2e2e2;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
button {
  font-size: 15px;
  padding: 10px 20px;
  border-radius: 6px;
  border: 1px solid #d1d5db;
  background: #ffffff;
  cursor: pointer;
}
button:disabled {
  opacity: 0.4;
  cursor: default;
}
button.primary {
  background: #2563eb;
  color: #ffffff;
  border-color: #2563eb;
}
#slide-counter {
  font-size: 14px;
  color: #6b7280;
}
`;

export const VIEWER_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Course</title>
    <link rel="stylesheet" href="viewer.css" />
  </head>
  <body>
    <div id="app">
      <header>
        <h1 id="course-title">Course</h1>
        <div id="progress-track"><div id="progress-fill"></div></div>
        <span id="slide-counter"></span>
      </header>
      <main>
        <div id="module-label"></div>
        <h2 id="slide-title"></h2>
        <img id="slide-image" style="display: none" alt="" />
        <ul id="slide-bullets"></ul>
        <div id="slide-example" style="display: none"></div>
      </main>
      <footer>
        <button id="prev-btn">Previous</button>
        <button id="next-btn" class="primary">Next</button>
      </footer>
    </div>
    <script src="scorm-api.js"></script>
    <script src="viewer.js"></script>
  </body>
</html>
`;

export const VIEWER_JS = `(function () {
  "use strict";

  let slides = [];
  let courseTitle = "";
  let current = 0;

  const titleEl = document.getElementById("course-title");
  const moduleLabelEl = document.getElementById("module-label");
  const slideTitleEl = document.getElementById("slide-title");
  const imageEl = document.getElementById("slide-image");
  const bulletsEl = document.getElementById("slide-bullets");
  const exampleEl = document.getElementById("slide-example");
  const counterEl = document.getElementById("slide-counter");
  const progressFillEl = document.getElementById("progress-fill");
  const prevBtn = document.getElementById("prev-btn");
  const nextBtn = document.getElementById("next-btn");

  function render() {
    const slide = slides[current];
    if (!slide) return;

    moduleLabelEl.textContent = slide.moduleTitle;
    slideTitleEl.textContent = slide.title;

    if (slide.imagePath) {
      imageEl.src = slide.imagePath;
      imageEl.style.display = "";
    } else {
      imageEl.style.display = "none";
    }

    bulletsEl.innerHTML = "";
    (slide.bullets || []).forEach((b) => {
      const li = document.createElement("li");
      li.textContent = b;
      bulletsEl.appendChild(li);
    });

    if (slide.exampleText) {
      exampleEl.textContent = "Real-world example: " + slide.exampleText;
      exampleEl.style.display = "";
    } else {
      exampleEl.style.display = "none";
    }

    counterEl.textContent = "Slide " + (current + 1) + " of " + slides.length;
    progressFillEl.style.width = Math.round(((current + 1) / slides.length) * 100) + "%";
    prevBtn.disabled = current === 0;
    nextBtn.textContent = current === slides.length - 1 ? "Finish" : "Next";

    window.SCORM.setProgress(current);
    if (current === slides.length - 1) {
      window.SCORM.setCompleted();
    }
  }

  function goTo(index) {
    if (index < 0 || index >= slides.length) return;
    current = index;
    render();
  }

  prevBtn.addEventListener("click", () => goTo(current - 1));
  nextBtn.addEventListener("click", () => {
    if (current === slides.length - 1) {
      window.SCORM.finish();
      return;
    }
    goTo(current + 1);
  });

  window.addEventListener("beforeunload", () => {
    window.SCORM.commit();
  });

  fetch("slides.json")
    .then((res) => res.json())
    .then((data) => {
      slides = data.slides;
      courseTitle = data.courseTitle;
      titleEl.textContent = courseTitle;
      window.SCORM.init();
      const resumeIndex = window.SCORM.getResumeLocation();
      goTo(resumeIndex > 0 && resumeIndex < slides.length ? resumeIndex : 0);
    });
})();
`;
