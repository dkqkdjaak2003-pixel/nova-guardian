import Phaser from 'phaser';

// ─────────────────────────────────────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 스케일 모드 선택
 *
 * 'fit'  - 종횡비 유지. 빈 여백(letterbox / pillarbox)이 생길 수 있음.
 *          예) 세로폰에서 가로게임 → 위아래 검은 바
 *
 * 'fill' - 화면 꽉 채움. 종횡비 불일치 시 이미지가 늘어남(왜곡).
 *          모바일 전체화면 강제 표시 시 사용.
 */
export type ScaleMode = 'fit' | 'fill';

/** buildScaleConfig()에 전달하는 옵션 */
export interface DisplayOptions {
  /** 스케일 방식 (기본값: 'fit') */
  mode?: ScaleMode;
  /**
   * HiDPI(Retina) 렌더링 활성화 여부.
   * true: 캔버스 해상도 = 논리 해상도 × devicePixelRatio → 선명.
   *        단, GPU 부담 증가. 고사양 기기 권장.
   * false: 논리 해상도 그대로 렌더링 (기본값).
   */
  enableHiDPI?: boolean;
}

/** getScaleInfo()가 반환하는 현재 스케일 상태 */
export interface ScaleInfo {
  // ── 게임 내부 좌표 해상도 (Phaser가 사용하는 논리 크기) ──────────────────
  logicalW: number;
  logicalH: number;
  // ── 브라우저에서 실제 보이는 CSS 크기 (px) ──────────────────────────────
  cssW: number;
  cssH: number;
  /** CSS 픽셀 1개당 게임 픽셀 수. 터치/마우스 좌표 변환에 사용. */
  scale: number;
  /** FIT 모드의 수평 centering offset (px). FILL이면 0. */
  offsetX: number;
  /** FIT 모드의 수직 centering offset (px). FILL이면 0. */
  offsetY: number;
  /** window.devicePixelRatio (Retina=2, 일반=1) */
  dpr: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// DisplayManager (static singleton)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DisplayManager
 * ─────────────────────────────────────────────────────────────────────────────
 * 담당 범위:
 *  1) Phaser ScaleConfig 생성          → buildScaleConfig()
 *  2) 현재 스케일 정보 계산            → getScaleInfo()
 *  3) 브라우저 리사이즈 감지 + 동기화  → init() / destroy()
 *  4) CSS 커스텀 프로퍼티 자동 갱신    → syncCSS() (내부)
 *
 * 사용 예:
 *   // main.ts
 *   const scaleConfig = DisplayManager.buildScaleConfig({ mode: 'fit' });
 *   const game = new Phaser.Game({ ...config, scale: scaleConfig });
 *   DisplayManager.init(game);
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class DisplayManager {

  // ── 게임 논리 해상도 (고정값, 변경 불가) ────────────────────────────────
  static readonly LOGICAL_W = 800;
  static readonly LOGICAL_H = 600;

  private static mode: ScaleMode = 'fit';
  private static hiDPI = false;
  private static game: Phaser.Game | null = null;
  private static observer: ResizeObserver | null = null;

  // ── PUBLIC: Phaser 설정 ──────────────────────────────────────────────────

  /**
   * Phaser GameConfig.scale 에 넣을 설정 객체를 반환합니다.
   *
   * ┌──────────────────────────────────────────────────────────────────────┐
   * │  왜 CSS만으로 처리하지 않고 JS(Phaser Scale)가 필요한가?             │
   * │                                                                      │
   * │  CSS transform: scale() 또는 width/height 변경은                     │
   * │  브라우저가 캔버스를 '그림'처럼 늘릴 뿐, 캔버스 버퍼 해상도        │
   * │  (canvas.width × canvas.height)는 그대로입니다.                     │
   * │  결과: 업스케일 시 픽셀이 흐릿해짐(bilinear interpolation).          │
   * │                                                                      │
   * │  Phaser Scale Manager는 canvas.style.width/height 와                 │
   * │  canvas.width/height 를 함께 제어하므로 게임 좌표계도 동시에         │
   * │  올바르게 유지됩니다.                                                │
   * └──────────────────────────────────────────────────────────────────────┘
   */
  static buildScaleConfig(options: DisplayOptions = {}): Phaser.Types.Core.ScaleConfig {
    this.mode   = options.mode       ?? 'fit';
    this.hiDPI  = options.enableHiDPI ?? false;

    /**
     * devicePixelRatio를 고려해야 하는 이유
     * ─────────────────────────────────────
     * Retina(DPR=2) 디스플레이는 CSS 픽셀 1개 = 물리 픽셀 2×2개.
     *
     * 캔버스 크기 800×600 + CSS 크기 800×600
     *   → 브라우저가 2배 업스케일 → 흐릿함(blurry)
     *
     * 캔버스 크기 1600×1200 + CSS 크기 800×600 (DPR=2 적용)
     *   → 1:1 물리 픽셀 대응 → 선명함(crisp)
     *
     * Phaser에서는 zoom: dpr 로 논리 해상도를 DPR배 늘려 처리하거나,
     * WebGL renderer가 내부적으로 처리합니다.
     */
    const dpr = this.clampDPR();

    return {
      // ── 스케일 모드 ──────────────────────────────────────────────────────
      // FIT     : 종횡비 유지, 여백 허용 (Letterbox/Pillarbox)
      // ENVELOP : 종횡비 유지, 여백 없이 꽉 채움 (일부 잘릴 수 있음)
      mode:       this.mode === 'fit' ? Phaser.Scale.FIT : Phaser.Scale.ENVELOP,
      autoCenter: Phaser.Scale.CENTER_BOTH,

      // ── 논리 해상도 ──────────────────────────────────────────────────────
      width:  this.LOGICAL_W,
      height: this.LOGICAL_H,

      // ── HiDPI: zoom = DPR ────────────────────────────────────────────────
      // zoom: N 이면 Phaser가 canvas.width = logicalW * N 으로 설정.
      // N = DPR 이면 물리 픽셀과 1:1 대응 → Retina에서 선명하게 렌더링.
      // 단, GPU 부담이 DPR² 배 증가하므로 저사양 기기에서는 비활성화 권장.
      zoom: this.hiDPI ? dpr : 1,
    };
  }

  // ── PUBLIC: 스케일 정보 조회 ─────────────────────────────────────────────

  /**
   * 현재 뷰포트와 게임 해상도를 기반으로 스케일 정보를 계산합니다.
   * 이 메서드는 순수 계산만 하고 DOM을 변경하지 않습니다.
   *
   * 활용 예) 터치 이벤트 좌표를 게임 좌표로 변환:
   *   const { scale, offsetX, offsetY } = DisplayManager.getScaleInfo();
   *   const gameX = (touchX - offsetX) / scale;
   */
  static getScaleInfo(): ScaleInfo {
    const dpr    = this.clampDPR();
    const vw     = window.innerWidth;
    const vh     = window.innerHeight;
    const aspect = this.LOGICAL_W / this.LOGICAL_H;

    let cssW: number, cssH: number, offsetX: number, offsetY: number;

    if (this.mode === 'fit') {
      // ── FIT (종횡비 유지 / Letterbox) ──────────────────────────────────
      //
      //  뷰포트                       게임(800×600, aspect=4:3)
      //  ┌─────────────────────┐      뷰포트가 더 넓은 경우 (landscape 폰)
      //  │░░░ [게임 영역] ░░░░│  →   좌우에 여백(pillarbox)
      //  └─────────────────────┘
      //
      //  뷰포트가 더 좁은 경우 (작은 화면)
      //  ┌───────┐
      //  │░░░░░░░│ → 상하에 여백(letterbox)
      //  │[게임] │
      //  │       │
      //  │░░░░░░░│
      //  └───────┘
      if (vw / vh > aspect) {
        // 뷰포트가 게임 비율보다 넓음 → 세로 기준 맞춤
        cssH = vh;
        cssW = vh * aspect;
      } else {
        // 뷰포트가 게임 비율보다 좁음 → 가로 기준 맞춤
        cssW = vw;
        cssH = vw / aspect;
      }
      offsetX = (vw - cssW) / 2;
      offsetY = (vh - cssH) / 2;

    } else {
      // ── FILL (꽉 채우기 / Stretch) ──────────────────────────────────────
      //
      // 종횡비를 무시하고 뷰포트 전체를 채웁니다.
      // 게임 비율(4:3)과 화면 비율이 다르면 이미지가 늘어납니다.
      // 사용 목적: 미적 여백 없이 몰입감 극대화, 약간의 왜곡 허용.
      cssW = vw; cssH = vh;
      offsetX = 0; offsetY = 0;
    }

    return {
      logicalW: this.LOGICAL_W,
      logicalH: this.LOGICAL_H,
      cssW, cssH,
      scale:   cssW / this.LOGICAL_W,
      offsetX, offsetY,
      dpr,
    };
  }

  // ── PUBLIC: 리사이즈 감지 생명주기 ──────────────────────────────────────

  /**
   * Phaser 게임 인스턴스를 등록하고 리사이즈 감시를 시작합니다.
   * `new Phaser.Game()` 직후 호출하세요.
   *
   * ResizeObserver 우선 사용 이유:
   *   window.resize는 윈도우 크기 변경만 감지하지만,
   *   ResizeObserver는 요소 크기 변화(소프트 키보드, 브라우저 UI 변화 등)도
   *   감지하므로 모바일에서 더 신뢰성이 높습니다.
   */
  static init(game: Phaser.Game): void {
    this.game = game;
    this.syncCSS();

    if (typeof ResizeObserver !== 'undefined') {
      // 표준 API (Chrome 64+, Firefox 69+, Safari 13.1+)
      this.observer = new ResizeObserver(this.onResize);
      this.observer.observe(document.documentElement);
    } else {
      // 구형 브라우저 fallback
      window.addEventListener('resize', this.onResize);
    }
  }

  /** 리스너·옵저버를 모두 정리합니다 (씬 전환 등에서 호출). */
  static destroy(): void {
    this.observer?.disconnect();
    this.observer = null;
    window.removeEventListener('resize', this.onResize);
    this.game = null;
  }

  // ── PRIVATE ──────────────────────────────────────────────────────────────

  /** devicePixelRatio를 1 이상 2 이하로 제한 (메모리/성능 보호) */
  private static clampDPR(): number {
    return Math.min(Math.max(window.devicePixelRatio || 1, 1), 2);
  }

  /**
   * 리사이즈 핸들러 (arrow function: this 바인딩 고정)
   * Phaser의 ScaleManager.refresh()를 호출해 내부 bound 재계산을 유도.
   */
  private static onResize = (): void => {
    this.syncCSS();
    // Phaser ScaleManager가 컨테이너 크기를 다시 읽어 캔버스 배치를 갱신
    this.game?.scale.refresh();
  };

  /**
   * 스케일 정보를 CSS Custom Properties로 주입합니다.
   *
   * CSS/HTML 오버레이에서 다음과 같이 사용 가능:
   *   width: var(--game-css-w);      // 현재 게임 표시 너비
   *   transform: scale(var(--game-scale));  // 게임 배율
   *
   * 사용 가능한 변수:
   *   --game-css-w   : 게임 영역 CSS 너비 (px 포함)
   *   --game-css-h   : 게임 영역 CSS 높이
   *   --game-off-x   : 수평 centering offset (FIT 여백)
   *   --game-off-y   : 수직 centering offset
   *   --game-scale   : CSS픽셀당 게임픽셀 비율 (숫자)
   *   --dpr          : devicePixelRatio (숫자)
   */
  private static syncCSS(): void {
    const s = this.getScaleInfo();
    const r = document.documentElement.style;
    r.setProperty('--game-css-w',  `${s.cssW}px`);
    r.setProperty('--game-css-h',  `${s.cssH}px`);
    r.setProperty('--game-off-x',  `${s.offsetX}px`);
    r.setProperty('--game-off-y',  `${s.offsetY}px`);
    r.setProperty('--game-scale',  String(s.scale));
    r.setProperty('--dpr',         String(s.dpr));
  }
}
