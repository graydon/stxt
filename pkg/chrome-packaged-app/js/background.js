chrome.app.runtime.onLaunched.addListener(function() {
  chrome.app.window.create('../html/window.html', {
    'bounds': {
        'left': 100,
        'top': 100,
        'width': 800,
        'height': 500
    }
  });

  chrome.app.window.create('../html/test/test.html', {
    'bounds': {
        'left': 900,
        'top': 100,
        'width': 400,
        'height': 500
    }
  });

});
