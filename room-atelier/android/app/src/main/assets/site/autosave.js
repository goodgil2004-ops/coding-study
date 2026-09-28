// 새로고침 직전 작업을 동기식으로 남기는 localStorage 키입니다.
export const RECOVERY_KEY = 'room-atelier-recovery-v1';
/** 자동 저장 관리자: getData=현재 공간, write=IndexedDB 쓰기, storage=복구 저장소.
 * ready 이전에는 저장하지 않아 시작 화면이 기존 작업을 덮어쓰지 않습니다.
 * 방에 추가된 가구와 공간이 대상이며, 제작실의 미확정 초안은 대상이 아닙니다. */
export function createAutosave({
  getData,
  write,
  storage,
  onStatus,
  delay = 250
}) {
  let timer, pending = null,
    running = null,
    lastStamp = 0,
    ready = false;
  // 쓰기를 직렬화합니다. 느린 이전 저장이 최신 상태를 덮어쓰는 경합을 막습니다.
  async function drain() {
    if (running) return running;
    running = (async () => {
      // 저장 중 새 변경이 생기면 마지막 스냅샷까지 순서대로 처리합니다.
      while (pending) {
        const job = pending;
        pending = null;
        try {
          await write(job);
          if (!pending) onStatus('saved');
        } catch (e) {
          if (!pending) onStatus('error');
          throw e;
        }
      }
    })();
    try {
      await running;
    } finally {
      running = null;
    }
  }
  // 변경 즉시 복구 사본을 만들고, 잦은 IndexedDB 쓰기는 250ms로 묶습니다.
  function schedule() {
    if (!ready) return;
    // 같은 밀리초에 변경되어도 최신 스냅샷을 정렬할 수 있는 단조 증가값입니다.
    lastStamp = Math.max(Date.now(), lastStamp + 1);
    // 참조 대신 독립 사본을 보관하여 이후 드래그가 저장 중인 객체를 바꾸지 않게 합니다.
    pending = JSON.parse(JSON.stringify({
      ...getData(),
      _savedAt: lastStamp
    }));
    // localStorage에는 용량 제한이 있습니다. 큰 모델은 복구 사본 기록에 실패할 수
    // 있으므로 IndexedDB 결과를 별도로 확인하며 파일 내보내기도 제공합니다.
    try {
      storage.setItem(RECOVERY_KEY, JSON.stringify(pending));
    } catch (e) {
      onStatus('backup-error');
    }
    onStatus('saving');
    clearTimeout(timer);
    timer = setTimeout(() => drain().catch(() => {}), delay);
  }
  // flush는 저장 버튼·백그라운드 전환에 사용합니다. 마지막 상태도 다시 수집합니다.
  return {
    enable() {
      ready = true;
    },
    schedule,
    async flush() {
      clearTimeout(timer);
      schedule();
      clearTimeout(timer);
      await drain();
      if (pending) await drain();
    }
  };
}
// 복구 사본·IndexedDB·구버전 데이터를 최신순으로 반환합니다.
// 실제 스키마 검증과 모델 로딩은 app.js가 후보별로 수행합니다.
export function recoveryCandidates(current, storage) {
  let recovery = null,
    legacy = null;
  try {
    recovery = JSON.parse(storage.getItem(RECOVERY_KEY) || 'null');
  } catch {}
  try {
    legacy = JSON.parse(storage.getItem('room-atelier-v1') || 'null');
  } catch {}
  return [recovery, current, legacy].filter(Boolean).sort((a, b) => (b._savedAt || 0) - (a._savedAt || 0));
}
