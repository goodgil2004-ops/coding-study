// A second tap preserves user activation after asynchronous PNG/GLB generation.
/** JSON·PNG·GLB를 동일한 인터페이스로 내보냅니다.
 * iOS는 사용자 탭으로 공유를 실행하고, 다른 환경은 다운로드 링크를 사용합니다.
 * Android 앱에서는 android-bridge.js가 링크 클릭을 파일 저장 창으로 연결합니다. */
export function saveFile(data, filename, type = 'application/octet-stream') {
  const file = new File([data], filename, {
    type
  });
  const url = URL.createObjectURL(file);
  // 데스크톱 사용자 에이전트를 쓰는 iPad도 터치 정보로 구분합니다.
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  // Blob URL은 즉시 해제하지 않습니다. 비동기 파일 읽기 시간을 확보합니다.
  if (!ios) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return;
  }
  // PNG/GLB 생성 뒤에는 사용자 활성화가 만료될 수 있어 별도 저장 버튼을 띄웁니다.
  document.querySelector('.file-save-dialog')?.close();
  const dialog = document.createElement('dialog');
  dialog.className = 'file-save-dialog';
  const title = document.createElement('h2');
  title.textContent = '파일 저장';
  const message = document.createElement('p');
  message.textContent = filename + '\n공유 메뉴에서 “파일에 저장”을 선택하세요.';
  const share = document.createElement('button');
  share.textContent = '공유 · 파일에 저장';
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.textContent = '다운로드';
  const close = document.createElement('button');
  close.textContent = '닫기';
  close.onclick = () => dialog.close();
  // 기기가 해당 파일 공유를 지원하지 않으면 다운로드만 제공합니다.
  share.hidden = !navigator.canShare?.({
    files: [file]
  });
  if (share.hidden) message.textContent = filename + '\n다운로드한 파일은 파일 앱에서 확인하세요.';
  share.onclick = async () => {
    try {
      await navigator.share({
        files: [file]
      });
      dialog.close();
    } catch (e) {
      if (e.name !== 'AbortError') message.textContent = '공유할 수 없습니다. 아래 다운로드를 이용해 주세요.';
    }
  };
  dialog.append(title, message, share, link, close);
  document.body.append(dialog);
  // 창을 닫으면 DOM과 임시 URL을 정리합니다.
  dialog.addEventListener('close', () => {
    dialog.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }, {
    once: true
  });
  dialog.showModal();
}
