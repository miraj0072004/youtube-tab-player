console.log("SUCCESS: YouTube Tab Player content script is running! URL:", window.location.href);

// Function to find the video element
const getVideo = () => {
  const video = document.querySelector('video');
  if (!video) {
    console.log("CONTENT: No video element found yet on", window.location.href);
  }
  return video;
};

// Function to monitor and handle video
const monitorVideo = () => {
  const video = getVideo();
  if (video) {
    console.log("CONTENT: Video element found on", window.location.href);
    
    // Disable looping
    video.loop = false;
    console.log("CONTENT: Set video.loop to", video.loop);

    // Periodically check if looping is re-enabled
    const checkLoop = setInterval(() => {
      if (video.loop) {
        console.log("CONTENT: Loop property was re-enabled. Forcing video.loop = false.");
        video.loop = false;
      }
    }, 500);

    // Detect video end using timeupdate
    let hasEnded = false;
    video.addEventListener('timeupdate', () => {
      if (!hasEnded && video.currentTime >= video.duration - 0.5) {
        hasEnded = true; // Prevent multiple triggers
        console.log("CONTENT: Video reached end (timeupdate) on", window.location.href, "currentTime:", video.currentTime, "duration:", video.duration);
        chrome.runtime.sendMessage({ message: 'video_ended' });
      }
    });

    // Also listen for the native ended event as a fallback
    video.addEventListener('ended', () => {
      console.log("CONTENT: Native 'ended' event fired on", window.location.href);
      if (!hasEnded) {
        hasEnded = true; // Prevent duplicate triggers
        chrome.runtime.sendMessage({ message: 'video_ended' });
      }
    });

    // Ensure video plays if paused
    if (video.paused) {
      console.log("CONTENT: Video is paused. Attempting to play.");
      video.play().catch(error => console.error("CONTENT: Error playing video:", error));
    }

    // Monitor for video element changes
    const observer = new MutationObserver(() => {
      const newVideo = getVideo();
      if (!newVideo || newVideo !== video) {
        console.log("CONTENT: Video element changed or removed on", window.location.href);
        observer.disconnect();
        clearInterval(checkLoop);
        monitorVideo(); // Re-run to attach to new video
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

  } else {
    // Retry if video not found
    setTimeout(monitorVideo, 1000);
  }
};

monitorVideo();

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.message === 'play_video') {
    const video = getVideo();
    if (video) {
      console.log("CONTENT: Received play command for", window.location.href, ". Playing video.");
      video.play().then(() => {
        sendResponse({ status: "playing" });
      }).catch(error => {
        console.error("CONTENT: Error playing video:", error);
        sendResponse({ status: "error", error: error.message });
      });
    } else {
      console.log("CONTENT: No video found for play command on", window.location.href);
      sendResponse({ status: "no_video_found" });
    }
    return true; // Keep message channel open for async response
  }
});