import sharp from 'sharp';

const W = 1200;
const H = 630;

// 별 생성 (고정 시드 방식)
function makeStars(count) {
  const stars = [];
  let x = 7, y = 3;
  for (let i = 0; i < count; i++) {
    x = (x * 1664525 + 1013904223) & 0xffffffff;
    y = (y * 22695477 + 1)         & 0xffffffff;
    const px   = Math.abs(x % W);
    const py   = Math.abs(y % H);
    const size = (i % 7 === 0) ? 2.2 : (i % 3 === 0) ? 1.5 : 1;
    const op   = 0.4 + (i % 10) * 0.06;
    stars.push(`<circle cx="${px}" cy="${py}" r="${size}" fill="white" opacity="${op.toFixed(2)}"/>`);
  }
  return stars.join('\n  ');
}

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <!-- 배경 그라디언트 -->
    <radialGradient id="bg" cx="50%" cy="50%" r="70%">
      <stop offset="0%"   stop-color="#000820"/>
      <stop offset="100%" stop-color="#000008"/>
    </radialGradient>
    <!-- 타이틀 글로우 -->
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="6" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <!-- 서브 글로우 (약하게) -->
    <filter id="glow2" x="-10%" y="-10%" width="120%" height="120%">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <!-- 테두리 그라디언트 -->
    <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%"   stop-color="#003355" stop-opacity="0"/>
      <stop offset="20%"  stop-color="#00ccff" stop-opacity="0.8"/>
      <stop offset="80%"  stop-color="#00ccff" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="#003355" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="borderGradV" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%"   stop-color="#003355" stop-opacity="0"/>
      <stop offset="20%"  stop-color="#00ccff" stop-opacity="0.6"/>
      <stop offset="80%"  stop-color="#00ccff" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="#003355" stop-opacity="0"/>
    </linearGradient>
    <!-- 중앙 원형 글로우 -->
    <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%"   stop-color="#0044aa" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#000008" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- 배경 -->
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#centerGlow)"/>

  <!-- 별 -->
  ${makeStars(180)}

  <!-- 장식: 가로 스캔라인 (희미) -->
  ${Array.from({length: 20}, (_, i) => {
    const y = 30 + i * 30;
    return `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#00ccff" stroke-opacity="0.03" stroke-width="1"/>`;
  }).join('\n  ')}

  <!-- 테두리 프레임 -->
  <rect x="32" y="32" width="${W-64}" height="${H-64}"
        fill="none" stroke="#00ccff" stroke-opacity="0.15" stroke-width="1" rx="4"/>

  <!-- 상단 테두리 라인 (그라디언트) -->
  <rect x="0" y="32" width="${W}" height="1.5" fill="url(#borderGrad)"/>
  <rect x="0" y="${H-33}" width="${W}" height="1.5" fill="url(#borderGrad)"/>
  <rect x="32" y="0" width="1.5" height="${H}" fill="url(#borderGradV)"/>
  <rect x="${W-33}" y="0" width="1.5" height="${H}" fill="url(#borderGradV)"/>

  <!-- 코너 장식 -->
  <polyline points="32,80  32,32  80,32"  fill="none" stroke="#00ccff" stroke-width="2.5" stroke-opacity="0.9"/>
  <polyline points="${W-80},32  ${W-32},32  ${W-32},80"  fill="none" stroke="#00ccff" stroke-width="2.5" stroke-opacity="0.9"/>
  <polyline points="32,${H-80}  32,${H-32}  80,${H-32}"  fill="none" stroke="#00ccff" stroke-width="2.5" stroke-opacity="0.9"/>
  <polyline points="${W-80},${H-32}  ${W-32},${H-32}  ${W-32},${H-80}"  fill="none" stroke="#00ccff" stroke-width="2.5" stroke-opacity="0.9"/>

  <!-- 우주선 (중앙 상단) -->
  <!-- 동체 -->
  <polygon points="600,170 560,240 640,240"
           fill="#00aadd" fill-opacity="0.85" filter="url(#glow2)"/>
  <!-- 왼쪽 날개 -->
  <polygon points="560,240 520,270 548,250"
           fill="#0088bb" fill-opacity="0.8"/>
  <!-- 오른쪽 날개 -->
  <polygon points="640,240 680,270 652,250"
           fill="#0088bb" fill-opacity="0.8"/>
  <!-- 엔진 불꽃 -->
  <polygon points="585,242 615,242 600,290"
           fill="#ff6600" fill-opacity="0.7" filter="url(#glow2)"/>
  <polygon points="590,242 610,242 600,270"
           fill="#ffcc00" fill-opacity="0.9"/>
  <!-- 조종석 창문 -->
  <ellipse cx="600" cy="210" rx="10" ry="14"
           fill="#aaeeff" fill-opacity="0.6"/>

  <!-- 레이저 빔 -->
  <line x1="600" y1="168" x2="600" y2="80"
        stroke="#00ffcc" stroke-width="3" stroke-opacity="0.8" filter="url(#glow2)"/>
  <line x1="600" y1="168" x2="600" y2="80"
        stroke="white" stroke-width="1" stroke-opacity="0.9"/>

  <!-- 적 (작은 삼각형들) -->
  <polygon points="200,120 185,150 215,150" fill="#ff3355" fill-opacity="0.8" filter="url(#glow2)"/>
  <polygon points="980,130 965,160 995,160" fill="#ff3355" fill-opacity="0.8" filter="url(#glow2)"/>
  <polygon points="140,200 125,230 155,230" fill="#ff5500" fill-opacity="0.7"/>
  <polygon points="1040,200 1025,230 1055,230" fill="#ff5500" fill-opacity="0.7"/>
  <polygon points="260,90 248,112 272,112"  fill="#ff3355" fill-opacity="0.6"/>
  <polygon points="920,95 908,117 932,117"  fill="#ff3355" fill-opacity="0.6"/>

  <!-- 파티클 / 탄환 -->
  <circle cx="440" cy="160" r="3" fill="#00ffcc" fill-opacity="0.8"/>
  <circle cx="390" cy="200" r="2" fill="#00ccff" fill-opacity="0.7"/>
  <circle cx="800" cy="155" r="3" fill="#00ffcc" fill-opacity="0.8"/>
  <circle cx="840" cy="195" r="2" fill="#00ccff" fill-opacity="0.7"/>

  <!-- 메인 타이틀 -->
  <text x="${W/2}" y="360"
        font-family="'Courier New', Courier, monospace"
        font-size="96"
        font-weight="bold"
        letter-spacing="18"
        fill="#00eeff"
        text-anchor="middle"
        filter="url(#glow)">NOVA GUARDIAN</text>

  <!-- 타이틀 하단 구분선 -->
  <rect x="${W/2 - 280}" y="378" width="560" height="2"
        fill="url(#borderGrad)" rx="1"/>

  <!-- 서브타이틀 -->
  <text x="${W/2}" y="430"
        font-family="'Courier New', Courier, monospace"
        font-size="22"
        letter-spacing="8"
        fill="#336688"
        text-anchor="middle">OMNIDIRECTIONAL SHOOTING DEFENSE</text>

  <!-- 태그라인 -->
  <text x="${W/2}" y="490"
        font-family="'Courier New', Courier, monospace"
        font-size="17"
        letter-spacing="4"
        fill="#00ccff"
        fill-opacity="0.7"
        text-anchor="middle">무한 웨이브  ·  TOP 10 랭킹  ·  PC · 모바일</text>

  <!-- 하단 URL -->
  <text x="${W/2}" y="565"
        font-family="'Courier New', Courier, monospace"
        font-size="14"
        letter-spacing="2"
        fill="#334455"
        text-anchor="middle">dkqkdjaak2003-pixel.github.io/nova-guardian</text>

  <!-- PLAY NOW 버튼 스타일 배지 -->
  <rect x="${W/2 - 90}" y="510" width="180" height="38" rx="4"
        fill="#003366" fill-opacity="0.6"
        stroke="#00ccff" stroke-width="1" stroke-opacity="0.7"/>
  <text x="${W/2}" y="534"
        font-family="'Courier New', Courier, monospace"
        font-size="15"
        font-weight="bold"
        letter-spacing="5"
        fill="#00eeff"
        text-anchor="middle">▶  PLAY FREE</text>
</svg>
`.trim();

const buf = Buffer.from(svg, 'utf-8');

await sharp(buf)
  .resize(W, H)
  .png({ compressionLevel: 9 })
  .toFile('public/og-image.png');

console.log('✅  public/og-image.png 생성 완료 (1200×630)');
