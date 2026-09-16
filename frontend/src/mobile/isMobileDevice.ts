export function isMobileDevice(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const params = new URLSearchParams(window.location.search);
  if (params.get("desktop") === "1") {
    return false;
  }
  if (params.get("mobile") === "1") {
    return true;
  }

  const ua = navigator.userAgent || "";
  const uaMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua);

  const narrow = window.matchMedia("(max-width: 900px)").matches;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const touchPoints = navigator.maxTouchPoints > 0;

  return uaMobile || (narrow && (coarse || touchPoints));
}
