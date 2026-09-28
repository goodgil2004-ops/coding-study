/**
 * 웹 다운로드를 안드로이드 파일 저장 화면으로 연결
 * 한국어 해설판: 주석과 줄바꿈을 정리했습니다. 실제 처리 방식은 원본과 같습니다.
 */
(() => {
  "use strict";

  /* Java가 주입한 인터페이스가 있을 때만 실행합니다. 일반 브라우저에서는 이 파일이 동작을 바꾸지 않습니다. */
  if (!window.RoomAndroid) return;

  /* 일반 링크의 원래 클릭 메서드를 보관해 다운로드 이외의 이동은 그대로 유지합니다. */
  const nativeClick =
    /* 기존 웹 내보내기 코드가 만든 a.download + blob/data URL의 클릭만 안드로이드 저장으로 연결합니다. */
    HTMLAnchorElement.prototype.click;
  let sending = false;

  /* 파일 준비/저장 결과를 표시하는 앱 전용 상태 메시지입니다. */
  function announce(message) {
    let status = document.getElementById("android-file-status");
    if (!status) {
      status = document.createElement("div");
      status.id = "android-file-status";
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      status.style.cssText =
        "position:fixed;bottom:22px;left:5%;right:5%;z-index:10000;background:#30362f;color:white;padding:14px 18px;border-radius:8px;font:14px/1.7 sans-serif;text-align:center;pointer-events:none";
      document.body.append(status);
    }
    status.textContent = message;
    status.hidden = false;
    clearTimeout(announce.timer);
    announce.timer = setTimeout(() => {
      status.hidden = true;
    }, 6000);
  }

  /* 안드로이드 저장 완료/취소 결과를 Java가 CustomEvent로 전달합니다. */
  window.addEventListener("android-export-result", (e) => announce(e.detail.message));

  /* Blob 다운로드를 Java의 begin→chunk→finish 호출로 옮깁니다. 전송 실패 시 abort로 임시 파일을 정리합니다. */
  async function save(href, name) {
    if (sending) return announce("현재 파일의 저장이 끝난 뒤 다시 시도해 주세요.");
    sending = true;
    let token = "";
    try {
      const response = await fetch(href);
      if (!response.ok) throw Error("파일을 읽지 못했어요.");
      const blob = await response.blob();
      if (blob.size > 120 * 1024 * 1024) throw Error("파일 저장은 120MB까지 지원해요.");

      /* 파일 이름/크기 검사와 임시 파일 준비를 Java에 요청합니다. 반환된 토큰은 현재 전송을 식별합니다. */
      token = RoomAndroid.begin(name, blob.type, blob.size);
      if (!token) throw Error("열려 있는 저장 화면을 먼저 완료해 주세요.");
      announce("파일을 준비하고 있어요…");

      /* 49,152바이트씩 읽어 Base64로 보냅니다. 인코딩 후 65,536문자가 되어 Java 쪽 청크 한도와 맞습니다. */
      for (let offset = 0; offset < blob.size; offset += 49152) {
        const bytes = new Uint8Array(await blob.slice(offset, offset + 49152).arrayBuffer());
        let raw = "";
        for (let i = 0; i < bytes.length; i++) raw += String.fromCharCode(bytes[i]);
        if (!RoomAndroid.chunk(token, btoa(raw)))
          throw Error("파일 준비에 실패했어요. 다시 시도해 주세요.");
      }

      /* 전송 완료는 저장 완료와 다릅니다. finish는 사용자에게 안드로이드 저장 위치 선택 화면을 띄웁니다. */
      if (!RoomAndroid.finish(token)) throw Error("파일을 저장하지 못했어요.");
      token = "";
      announce("파일을 저장할 위치를 선택해 주세요.");
    } catch (e) {
      if (token) RoomAndroid.abort(token);
      announce(e.message || "파일 저장에 실패했어요.");
    } finally {
      sending = false;
    }
  }
  HTMLAnchorElement.prototype.click = function() {
    if (this.download && /^(blob:|data:)/.test(this.href)) {
      void save(this.href, this.download);
      return;
    }
    return nativeClick.call(this);
  };
  document.addEventListener(
    "click",
    (e) => {
      const a = e.target.closest?.("a[download]");
      if (a && /^(blob:|data:)/.test(a.href)) {
        e.preventDefault();
        void save(a.href, a.download);
      }
    },
    true,
  );

  /* 안드로이드에서는 마우스 안내를 터치 안내로 바꾸고 저장 버튼 설명을 보완합니다. */
  window.addEventListener("DOMContentLoaded", () => {
    const tip = document.querySelector(".interaction-tip span");
    if (tip) tip.textContent = "한 손가락으로 배치·회전 · 두 손가락으로 확대";
    const saved = document.getElementById("save");
    if (saved) saved.title = "이 앱에 공간 저장";
  });
})();
