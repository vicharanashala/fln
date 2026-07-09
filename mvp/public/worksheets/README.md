# Where your 4 existing HTML files go

Put your already-built files here, renamed exactly like this:

```
public/worksheets/class1.html
public/worksheets/class2.html
public/worksheets/class3.html
public/worksheets/class4.html
```

Vite serves everything in `public/` as-is at the site root, so once the dev
server is running, `class1.html` is reachable at:

```
http://localhost:3000/worksheets/class1.html
```

That's the URL the dashboard's modal loads in an iframe. **Nothing about
your generation logic changes.**

---

## The one snippet to add to each file

Your files already build the question paper / answer key and trigger the
browser download (you said this part works). Right after that download
fires — wherever your existing code currently does the download trigger
(e.g. wherever you call `link.click()`, `a.download = ...`, or similar) —
add this:

```html
<script>
  // Tell the dashboard a download just completed. Drop this call right
  // after your existing download-trigger code — do not replace anything,
  // just add this block after it.
  function notifyDashboard(fileType, fileName, totalQuestions) {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(
        {
          type: "FLN_WORKSHEET_DOWNLOADED",
          classLevel: "CLASS_1", // change to CLASS_2 / CLASS_3 / CLASS_4 per file
          fileType: fileType, // "question_paper" or "answer_key"
          fileName: fileName, // use your real filename variable here
          totalQuestions: totalQuestions, // use your real count variable here
        },
        "*"
      );
    }
  }

  // Example of calling it right after your existing download logic:
  // notifyDashboard("question_paper", myFileName, myQuestionCount);
</script>
```

That's it — one function definition, one call, placed after code you
already have. Everything else in your file is untouched.

If a file generates only one type of output (just the paper, or just the
key) call `notifyDashboard` once with the matching `fileType`. If it
generates both in one go, call it twice.
