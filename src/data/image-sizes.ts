// Source canvas widths derived from page.css. Do not use the visible crop alone.
const at = (desktop: string, tablet: string, mobile?: string) =>
  (mobile ? `(max-width: 600px) ${mobile}, ` : '') +
  `(max-width: 1100px) ${tablet}, ${desktop}`;
export const imageSizes = {
  brand: at('213px', '150px'),
  sky: at('100vw', 'max(100vw, 998px)'),
  architecture: at('100vw', '950px', '850px'),
  water: at('100.35vw', '950px', '850px'),
  locationLarge: at('87.4vw', 'calc(126.94vw - 60.93px)'),
  locationAerial: at('75.27vw', 'calc(132.89vw - 90.36px)', 'calc(132.89vw - 85.05px)'),
  locationWater: at('19.063vw', 'calc(44.565vw - 30.30px)', 'calc(44.565vw - 28.52px)'),
  lifestyle: at('100vw', 'max(100vw, 775px)', 'max(100vw, 733px)'),
  leaf: at('115.833vw', 'max(160vw, 1000px)'),
  nature: at('68.75vw', 'calc(88vw - 42.24px)'),
  palmDetail: at('56.43vw', 'calc(106.44vw - 51.09px)'),
  presentation: at('148.39vw', 'max(160vw, 1067px)', 'max(200vw, 889px)'),
  arrival: at('91.51vw', 'calc(161.16vw - 77.36px)'),
  arrivalDetail: at('39.97vw', 'calc(91.74vw - 62.38px)'),
  interior: at('116.05vw', 'max(100vw, 836px)', 'max(100vw, 800px)'),
  categoryFirst: '49.08vw',
  categorySecond: '50.63vw',
  categoryThird: '35.81vw',
  palmAerial: at('28.472vw', 'calc(50vw - 36px)', 'calc(75vw - 36px)'),
  partnerLeaf: at('43.4vw', 'max(calc(100vw - 48px), 494px)'),
  collection: at('53.21vw', 'calc(100vw - 48px)'),
  // Full square source is cropped to the narrow wordmark, with original offsets.
  storyWordmark: at('36.73vw', '72.02vw'),
  enquiry: 'min(430px, 26.875vw)',
};
export const featureImageSizes = [
  at('23.958vw', 'calc(51.282vw - 34.872px)'),
  at('31.375vw', 'calc(69.23vw - 47.08px)'),
  at('46.657vw', 'calc(138.18vw - 93.97px)'),
  at('35.309vw', 'calc(68.38vw - 46.50px)'),
  at('15.156vw', 'calc(50vw - 34px)'),
  at('55.347vw', 'calc(106.95vw - 72.73px)'),
  at('48.99vw', 'calc(69.93vw - 47.55px)'),
  at('23.958vw', 'calc(50vw - 34px)'),
];
export const relatedImageSizes: Record<string, string> = {
  mansion: at('calc(28.62vw - 17.25px)', 'calc(44.55vw - 17.25px)', 'calc(66.83vw - 12.93px)'),
  landscape: at('calc(46.22vw - 27.85px)', 'calc(71.94vw - 27.85px)', 'calc(107.91vw - 20.88px)'),
  infrastructure: at('calc(28.98vw - 17.46px)', 'calc(45.11vw - 17.46px)', 'calc(67.66vw - 13.10px)'),
};
