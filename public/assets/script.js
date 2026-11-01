"use strict";

const form = document.querySelector("#shortenForm");
const urlInput = document.querySelector("#urlInput");
const submitButton = document.querySelector("#submitButton");
const submitButtonText = document.querySelector("#submitButtonText");
const submitButtonIcon = document.querySelector("#submitButtonIcon");
const formMessage = document.querySelector("#formMessage");
const resultCard = document.querySelector("#resultCard");
const shortUrlOutput = document.querySelector("#shortUrlOutput");
const copyButton = document.querySelector("#copyButton");
const copyButtonText = document.querySelector("#copyButtonText");
const copyFeedback = document.querySelector("#copyFeedback");
const resetButton = document.querySelector("#resetButton");

const ERROR_MESSAGES = {
  "invalid-json": "آدرس واردشده معتبر نیست. یک لینک کامل با http یا https وارد کن.",
  "unsupported-media-type": "نوع درخواست پشتیبانی نمی‌شود. صفحه را تازه‌سازی کن و دوباره تلاش کن.",
  "payload-too-large": "آدرس واردشده بیش از حد طولانی است.",
  "rate-limit-exceeded": "درخواست‌های زیادی فرستاده‌ای. کمی بعد دوباره تلاش کن.",
  "database-temporarily-unavailable": "ذخیره‌سازی موقتاً در دسترس نیست. دوباره تلاش کن.",
  "internal-server-error": "مشکلی در سرور پیش آمده است. لطفاً کمی بعد دوباره تلاش کن.",
};

function showMessage(message, type = "info") {
  formMessage.textContent = message;
  formMessage.className = `form-message is-${type}`;
  formMessage.hidden = !message;
}

function setLoading(isLoading) {
  submitButton.disabled = isLoading;
  submitButton.setAttribute("aria-busy", String(isLoading));
  submitButtonText.textContent = isLoading ? "در حال ساخت لینک..." : "کوتاه کردن لینک";
  submitButtonIcon.classList.toggle("is-spinning", isLoading);
}

function validateHttpUrl(value) {
  try {
    const parsedUrl = new URL(value);
    return ["http:", "https:"].includes(parsedUrl.protocol) && Boolean(parsedUrl.hostname);
  } catch {
    return false;
  }
}

async function readResponse(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function getErrorMessage(payload, status) {
  if (payload && typeof payload.error === "string" && ERROR_MESSAGES[payload.error]) {
    return ERROR_MESSAGES[payload.error];
  }

  if (status === 404) {
    return "مسیر موردنظر پیدا نشد. صفحه را تازه‌سازی کن.";
  }

  if (status >= 500) {
    return "سرور موقتاً پاسخ‌گو نیست. کمی بعد دوباره تلاش کن.";
  }

  return "ساخت لینک انجام نشد. لطفاً آدرس را بررسی و دوباره تلاش کن.";
}

function setResult(shortUrl) {
  shortUrlOutput.textContent = shortUrl;
  resultCard.hidden = false;
  copyFeedback.textContent = "";
  copyFeedback.classList.remove("is-copy-error");
  copyButtonText.textContent = "کپی";
  copyButton.classList.remove("is-copied");
}

async function handleSubmit(event) {
  event.preventDefault();
  showMessage("");
  resultCard.hidden = true;
  copyFeedback.textContent = "";

  const originalUrl = urlInput.value.trim();

  if (!urlInput.checkValidity() || !validateHttpUrl(originalUrl)) {
    showMessage("لطفاً یک آدرس کامل و معتبر با http:// یا https:// وارد کن.", "error");
    urlInput.focus();
    return;
  }

  setLoading(true);

  try {
    const response = await fetch("/shorten", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ url: originalUrl }),
      credentials: "same-origin",
    });

    const payload = await readResponse(response);

    if (!response.ok) {
      throw new Error(getErrorMessage(payload, response.status));
    }

    if (!payload || typeof payload.shorturl !== "string") {
      throw new Error("پاسخ سرور قابل‌خواندن نبود. دوباره تلاش کن.");
    }

    let shortUrl;

    try {
      shortUrl = new URL(payload.shorturl, window.location.origin);
    } catch {
      throw new Error("سرور یک لینک کوتاه معتبر برنگرداند.");
    }

    if (!["http:", "https:"].includes(shortUrl.protocol)) {
      throw new Error("سرور یک لینک کوتاه معتبر برنگرداند.");
    }

    setResult(shortUrl.href);
    showMessage("لینک با موفقیت ساخته شد.", "success");
  } catch (error) {
    const message = error instanceof TypeError
      ? "ارتباط با سرور برقرار نشد. اتصال اینترنت یا وضعیت سرور را بررسی کن."
      : error.message;
    showMessage(message || "خطای پیش‌بینی‌نشده‌ای رخ داد.", "error");
  } finally {
    setLoading(false);
  }
}

async function copyText(value) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const temporaryInput = document.createElement("textarea");
  temporaryInput.value = value;
  temporaryInput.setAttribute("readonly", "");
  temporaryInput.style.position = "fixed";
  temporaryInput.style.opacity = "0";
  temporaryInput.style.pointerEvents = "none";
  document.body.append(temporaryInput);
  temporaryInput.select();

  const copied = document.execCommand("copy");
  temporaryInput.remove();

  if (!copied) {
    throw new Error("کپی خودکار در این مرورگر در دسترس نیست. لینک را دستی انتخاب و کپی کن.");
  }
}

async function handleCopy() {
  const value = shortUrlOutput.textContent;

  if (!value) {
    return;
  }

  copyButton.disabled = true;

  try {
    await copyText(value);
    copyButtonText.textContent = "کپی شد";
    copyButton.classList.add("is-copied");
    copyFeedback.textContent = "لینک در کلیپ‌بورد کپی شد.";
  } catch (error) {
    copyFeedback.textContent = error.message || "امکان کپی لینک وجود نداشت.";
    copyFeedback.classList.add("is-copy-error");
  } finally {
    copyButton.disabled = false;
  }
}

function handleReset() {
  form.reset();
  resultCard.hidden = true;
  showMessage("");
  copyFeedback.textContent = "";
  copyFeedback.classList.remove("is-copy-error");
  urlInput.focus();
}

form.addEventListener("submit", handleSubmit);
copyButton.addEventListener("click", handleCopy);
resetButton.addEventListener("click", handleReset);

urlInput.addEventListener("input", () => {
  if (!formMessage.hidden && formMessage.classList.contains("is-error")) {
    showMessage("");
  }
});
