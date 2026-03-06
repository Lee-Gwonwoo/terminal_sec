# EODHD rules (skill)

### 언제 쓰나
- EODHD로 데이터를 다운로드/정규화/저장하는 스크립트를 만들거나 수정할 때.
- `original_data/` 또는 `EODHD/<symbol>/` 아래로 데이터를 저장하면서, 시간/컬럼/토큰 관련 “엄격 규칙”을 반드시 지켜야 할 때.

- **EODHD 규칙은 엄격**
  - `EODHD/INSTRUCTION.txt` 준수:
    - 저장되는 시간은 `America/New_York` 로컬.
    - 저장 출력물에는 `Timestamp` 컬럼을 포함하지 않음(중간 계산에만 사용 가능).
    - API 토큰은 `EODHD/API TOKEN`에서 읽음.
    - 심볼별 코드는/출력은 `EODHD/<symbol>/` 아래에 둠.
