import type { CSSProperties } from "react";
import {
  albumsOutline,
  archiveOutline,
  arrowDownOutline,
  arrowUpOutline,
  analyticsOutline,
  atOutline,
  banOutline,
  bookOutline,
  bookmarkOutline,
  brushOutline,
  calendarOutline,
  checkmarkCircleOutline,
  chatbubblesOutline,
  closeOutline,
  chevronBackOutline,
  chevronForwardOutline,
  cloudUploadOutline,
  codeSlashOutline,
  colorPaletteOutline,
  constructOutline,
  contrastOutline,
  copyOutline,
  createOutline,
  desktopOutline,
  documentAttachOutline,
  documentTextOutline,
  downloadOutline,
  eyeOutline,
  filterOutline,
  fileTrayOutline,
  folderOpenOutline,
  funnelOutline,
  gridOutline,
  heartOutline,
  homeOutline,
  imageOutline,
  imagesOutline,
  informationCircleOutline,
  keyOutline,
  libraryOutline,
  linkOutline,
  listOutline,
  logInOutline,
  logOutOutline,
  lockClosedOutline,
  mailOutline,
  mapOutline,
  menuOutline,
  moonOutline,
  newspaperOutline,
  openOutline,
  optionsOutline,
  peopleOutline,
  personAddOutline,
  personCircleOutline,
  pencilOutline,
  pricetagsOutline,
  radioButtonOnOutline,
  readerOutline,
  refreshOutline,
  saveOutline,
  searchOutline,
  sendOutline,
  serverOutline,
  settingsOutline,
  shieldCheckmarkOutline,
  sparklesOutline,
  statsChartOutline,
  sunnyOutline,
  swapVerticalOutline,
  terminalOutline,
  trashOutline,
  warningOutline,
} from "ionicons/icons";

const iconSources = {
  albums: albumsOutline,
  analytics: analyticsOutline,
  archive: archiveOutline,
  arrowDown: arrowDownOutline,
  arrowUp: arrowUpOutline,
  at: atOutline,
  ban: banOutline,
  book: bookOutline,
  bookmark: bookmarkOutline,
  brush: brushOutline,
  calendar: calendarOutline,
  checkmarkCircle: checkmarkCircleOutline,
  chatbubbles: chatbubblesOutline,
  chevronBack: chevronBackOutline,
  chevronForward: chevronForwardOutline,
  close: closeOutline,
  cloudUpload: cloudUploadOutline,
  codeSlash: codeSlashOutline,
  colorPalette: colorPaletteOutline,
  construct: constructOutline,
  contrast: contrastOutline,
  copy: copyOutline,
  create: createOutline,
  desktop: desktopOutline,
  documentAttach: documentAttachOutline,
  documentText: documentTextOutline,
  download: downloadOutline,
  eye: eyeOutline,
  filter: filterOutline,
  fileTray: fileTrayOutline,
  folderOpen: folderOpenOutline,
  funnel: funnelOutline,
  grid: gridOutline,
  heart: heartOutline,
  home: homeOutline,
  image: imageOutline,
  images: imagesOutline,
  informationCircle: informationCircleOutline,
  key: keyOutline,
  library: libraryOutline,
  link: linkOutline,
  list: listOutline,
  logIn: logInOutline,
  logOut: logOutOutline,
  lockClosed: lockClosedOutline,
  mail: mailOutline,
  map: mapOutline,
  menu: menuOutline,
  moon: moonOutline,
  newspaper: newspaperOutline,
  open: openOutline,
  options: optionsOutline,
  people: peopleOutline,
  personAdd: personAddOutline,
  personCircle: personCircleOutline,
  pencil: pencilOutline,
  pricetags: pricetagsOutline,
  radioButtonOn: radioButtonOnOutline,
  reader: readerOutline,
  refresh: refreshOutline,
  save: saveOutline,
  search: searchOutline,
  send: sendOutline,
  server: serverOutline,
  settings: settingsOutline,
  shield: shieldCheckmarkOutline,
  sparkles: sparklesOutline,
  statsChart: statsChartOutline,
  sunny: sunnyOutline,
  swapVertical: swapVerticalOutline,
  terminal: terminalOutline,
  trash: trashOutline,
  warning: warningOutline,
} as const;

export type AppIconName = keyof typeof iconSources;

export type AppIconProps = {
  className?: string;
  label?: string;
  name: AppIconName;
  size?: number | string;
};

function toSvgMarkup(source: string) {
  const svg = source.slice(source.indexOf(",") + 1);

  try {
    return decodeURIComponent(svg);
  } catch {
    return svg;
  }
}

export function AppIcon({ className, label, name, size = 20 }: AppIconProps) {
  const style: CSSProperties = {
    fontSize: typeof size === "number" ? `${size}px` : size,
  };

  return (
    <span
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={className ? `app-icon ${className}` : "app-icon"}
      dangerouslySetInnerHTML={{ __html: toSvgMarkup(iconSources[name]) }}
      role={label ? "img" : undefined}
      style={style}
    />
  );
}
