---
name: browser-automation
description: Browser automation patterns for brittle UIs (iframes, hidden inputs, segmented controls). Includes robust selector and wrapper-click guidance.
---

## EN

### Purpose
Use this skill when you need to drive a real web UI (login gates, toggles, tabs, export/code views) and DOM interactions are brittle due to iframes, overlays, or “radio/segmented control” implementations.

### Keywords
Playwright, iframe, frame, segmented control, toggle, hidden input, label, wrapper click, data-testid, aria, role, timeout

### Core rules
- Prefer stable selectors: `data-testid`, `role`, `aria-*`, and deterministic attributes (`name`, `for`, `id`).
- Treat timeouts as a selector/targeting problem first (not “page is slow”).
- Verify success via observable UI change (text, element presence, screenshot), not only via HTML attributes.

### When clicks fail: “wrapper (shell) click” playbook
Many UIs implement tabs/toggles with a hidden `<input type="radio">` and a visible wrapper (`label/div/span`). In these cases, clicking the input or `text=...` may fail even though the UI is clickable.

Step 1) Extract a stable hook
- Dump HTML and locate the real hooks (`data-testid`, `role`, `aria-label`).
- If the HTML is minified (single long line), parse it as raw text and extract the values programmatically (regex).

Step 2) Click the visible wrapper (in order)
- Try the direct testid target (sometimes works even if hidden):
	- CSS: `[data-testid="…"]`
- Try its label (sibling):
	- XPath: `//input[@data-testid='…']/following-sibling::label[1]`
- If label still isn’t the real click target, click the wrapper/option root (most reliable):
	- XPath: `//input[@data-testid='…']/ancestor::*[contains(@class,'optionRoot')][1]`

Step 3) Confirm the toggle actually switched
- Prefer an explicit wait for view-specific text/element:
	- Example (Code view): `wait_for("text=import React")`
	- Example (Preview view): `wait_for("text=Add Windows")`
- Take a screenshot after each state change.

### Notes for iframe-heavy apps
- If an element isn’t found in the main document, it may be inside an iframe.
- Use a “search all frames” strategy for click/fill/wait (iterate `page.frames()`), especially for apps like Figma.

---

## KO

### 목적
로그인/권한 게이트, 토글/탭, 코드/프리뷰 전환 같은 실제 웹 UI를 자동화할 때 사용합니다. iframe, 오버레이, “hidden radio + segmented control” 구조 때문에 DOM 클릭이 불안정한 경우를 대상으로 합니다.

### 키워드
Playwright, iframe, frame, segmented control, toggle, hidden input, label, wrapper(껍데기) click, data-testid, aria, role, timeout

### 핵심 규칙
- 안정적인 셀렉터를 우선 사용: `data-testid`, `role`, `aria-*`, 그리고 결정적인 속성(`name`, `for`, `id`).
- 타임아웃은 먼저 “페이지가 느림”이 아니라 “셀렉터/클릭 타겟 문제”로 간주합니다.
- 성공 판정은 HTML attribute만 보지 말고(예: `checked=""`) 실제 화면 변화(텍스트/요소/스크린샷)로 검증합니다.

### 클릭이 실패할 때: “wrapper(껍데기) 클릭” 절차
많은 UI가 탭/토글을 `<input type="radio">`(hidden) + 보이는 wrapper(`label/div/span`)로 구현합니다. 이런 경우 input이나 `text=...` 클릭은 실패하는데 화면은 클릭 가능한 상태일 수 있습니다.

1) 안정 훅 확보
- HTML을 덤프해서 실제 훅(`data-testid`, `role`, `aria-label`)을 찾습니다.
- HTML이 한 줄로 minify 되어 있으면 `-Raw`로 읽고 정규식으로 필요한 값만 추출합니다.

2) 보이는 껍데기 클릭(우선순위)
- testid 타겟 직접 클릭(가끔 hidden이어도 동작):
	- CSS: `[data-testid="…"]`
- label(형제) 클릭:
	- XPath: `//input[@data-testid='…']/following-sibling::label[1]`
- label이 실제 클릭 영역이 아니면 wrapper/option root 클릭(가장 강력):
	- XPath: `//input[@data-testid='…']/ancestor::*[contains(@class,'optionRoot')][1]`

3) 토글 전환 검증
- 뷰별 텍스트/요소를 `wait_for`로 확인:
	- 예(코드 뷰): `wait_for("text=import React")`
	- 예(프리뷰 뷰): `wait_for("text=Add Windows")`
- 상태 변경마다 스크린샷을 남깁니다.

### iframe이 많은 앱 참고
- 메인 문서에 없으면 iframe 내부일 가능성이 큽니다.
- 클릭/입력/대기를 모든 frame에서 시도하는 방식(`page.frames()` 순회)이 특히 Figma 같은 앱에서 효과적입니다.