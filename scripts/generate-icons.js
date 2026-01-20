const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const assetsDir = path.join(__dirname, '..', 'assets');

// Ensure assets directory exists
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// FCPos brand colors
const backgroundColor = '#0A1628';
const accentColor = '#00D4AA';
const textColor = '#FFFFFF';

// Create SVG for the icon
const createIconSVG = (size, isAdaptive = false) => {
  const padding = isAdaptive ? size * 0.2 : size * 0.1;
  const innerSize = size - (padding * 2);
  const fontSize = innerSize * 0.35;
  const subtitleSize = innerSize * 0.12;

  return `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="${backgroundColor}"/>

      <!-- Decorative corner accent -->
      <path d="M 0 0 L ${size * 0.3} 0 L 0 ${size * 0.3} Z" fill="${accentColor}" opacity="0.3"/>
      <path d="M ${size} ${size} L ${size * 0.7} ${size} L ${size} ${size * 0.7} Z" fill="${accentColor}" opacity="0.3"/>

      <!-- POS Terminal Icon -->
      <g transform="translate(${size/2}, ${size * 0.35})">
        <!-- Terminal body -->
        <rect x="-${innerSize * 0.2}" y="-${innerSize * 0.15}"
              width="${innerSize * 0.4}" height="${innerSize * 0.3}"
              rx="${innerSize * 0.02}" fill="${accentColor}"/>
        <!-- Screen -->
        <rect x="-${innerSize * 0.15}" y="-${innerSize * 0.12}"
              width="${innerSize * 0.3}" height="${innerSize * 0.15}"
              rx="${innerSize * 0.01}" fill="${backgroundColor}"/>
        <!-- Keypad dots -->
        <circle cx="-${innerSize * 0.08}" cy="${innerSize * 0.08}" r="${innerSize * 0.02}" fill="${backgroundColor}"/>
        <circle cx="0" cy="${innerSize * 0.08}" r="${innerSize * 0.02}" fill="${backgroundColor}"/>
        <circle cx="${innerSize * 0.08}" cy="${innerSize * 0.08}" r="${innerSize * 0.02}" fill="${backgroundColor}"/>
      </g>

      <!-- FC text -->
      <text x="${size/2}" y="${size * 0.62}"
            font-family="Arial, Helvetica, sans-serif"
            font-size="${fontSize}"
            font-weight="bold"
            fill="${textColor}"
            text-anchor="middle">FC</text>

      <!-- POS text -->
      <text x="${size/2}" y="${size * 0.78}"
            font-family="Arial, Helvetica, sans-serif"
            font-size="${fontSize * 0.7}"
            font-weight="bold"
            fill="${accentColor}"
            text-anchor="middle">POS</text>

      <!-- Bottom accent line -->
      <rect x="${size * 0.25}" y="${size * 0.88}"
            width="${size * 0.5}" height="${size * 0.02}"
            rx="${size * 0.01}" fill="${accentColor}"/>
    </svg>
  `;
};

// Create splash screen SVG
const createSplashSVG = (width, height) => {
  const fontSize = Math.min(width, height) * 0.15;
  const subtitleSize = fontSize * 0.3;

  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="${backgroundColor}"/>

      <!-- Top decorative element -->
      <ellipse cx="${width/2}" cy="0" rx="${width * 0.8}" ry="${height * 0.15}"
               fill="${accentColor}" opacity="0.1"/>

      <!-- Bottom decorative element -->
      <ellipse cx="${width/2}" cy="${height}" rx="${width * 0.8}" ry="${height * 0.15}"
               fill="${accentColor}" opacity="0.1"/>

      <!-- POS Terminal Icon -->
      <g transform="translate(${width/2}, ${height * 0.35})">
        <!-- Terminal body -->
        <rect x="-60" y="-45" width="120" height="90" rx="8" fill="${accentColor}"/>
        <!-- Screen -->
        <rect x="-48" y="-36" width="96" height="48" rx="4" fill="${backgroundColor}"/>
        <!-- Screen content lines -->
        <rect x="-40" y="-28" width="60" height="4" rx="2" fill="${accentColor}" opacity="0.5"/>
        <rect x="-40" y="-18" width="40" height="4" rx="2" fill="${accentColor}" opacity="0.5"/>
        <!-- Keypad dots -->
        <circle cx="-24" cy="24" r="6" fill="${backgroundColor}"/>
        <circle cx="0" cy="24" r="6" fill="${backgroundColor}"/>
        <circle cx="24" cy="24" r="6" fill="${backgroundColor}"/>
      </g>

      <!-- FCPos text -->
      <text x="${width/2}" y="${height * 0.55}"
            font-family="Arial, Helvetica, sans-serif"
            font-size="${fontSize}"
            font-weight="bold"
            fill="${textColor}"
            text-anchor="middle">FCPos</text>

      <!-- Tagline -->
      <text x="${width/2}" y="${height * 0.62}"
            font-family="Arial, Helvetica, sans-serif"
            font-size="${subtitleSize}"
            fill="${accentColor}"
            text-anchor="middle">Point of Sale</text>

      <!-- Loading indicator -->
      <g transform="translate(${width/2}, ${height * 0.75})">
        <circle cx="-20" cy="0" r="4" fill="${accentColor}" opacity="0.3"/>
        <circle cx="0" cy="0" r="4" fill="${accentColor}" opacity="0.6"/>
        <circle cx="20" cy="0" r="4" fill="${accentColor}"/>
      </g>
    </svg>
  `;
};

async function generateIcons() {
  console.log('Generating FCPos icons...');

  try {
    // Generate main icon (1024x1024)
    console.log('Creating icon.png (1024x1024)...');
    const iconSvg = Buffer.from(createIconSVG(1024));
    await sharp(iconSvg)
      .resize(1024, 1024)
      .png()
      .toFile(path.join(assetsDir, 'icon.png'));

    // Generate adaptive icon (1024x1024 with more padding)
    console.log('Creating adaptive-icon.png (1024x1024)...');
    const adaptiveIconSvg = Buffer.from(createIconSVG(1024, true));
    await sharp(adaptiveIconSvg)
      .resize(1024, 1024)
      .png()
      .toFile(path.join(assetsDir, 'adaptive-icon.png'));

    // Generate splash screen (1284x2778 for iPhone 13 Pro Max ratio)
    console.log('Creating splash.png (1284x2778)...');
    const splashSvg = Buffer.from(createSplashSVG(1284, 2778));
    await sharp(splashSvg)
      .resize(1284, 2778)
      .png()
      .toFile(path.join(assetsDir, 'splash.png'));

    // Generate favicon (48x48)
    console.log('Creating favicon.png (48x48)...');
    const faviconSvg = Buffer.from(createIconSVG(512));
    await sharp(faviconSvg)
      .resize(48, 48)
      .png()
      .toFile(path.join(assetsDir, 'favicon.png'));

    console.log('\nAll icons generated successfully!');
    console.log('Icons saved to:', assetsDir);
    console.log('\nGenerated files:');
    console.log('  - icon.png (1024x1024) - Main app icon');
    console.log('  - adaptive-icon.png (1024x1024) - Android adaptive icon');
    console.log('  - splash.png (1284x2778) - Splash screen');
    console.log('  - favicon.png (48x48) - Web favicon');

  } catch (error) {
    console.error('Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();
