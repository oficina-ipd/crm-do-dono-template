/** Design system v4 do CRM. Importe daqui; os estilos vêm de ../styles (tokens, base, componentes). */
export { Icon, type IconeV4 } from "./icon";
export { Button, IconButton, ButtonLink, classesBotao, type ButtonProps, type ButtonVariant } from "./button";
export { Field, Input, Textarea, Select, Checkbox, Switch, SearchInput } from "./field";
export { Tag, TipoTag, Badge, Avatar, KeyHint, Divider, iniciaisV4, type TagTom } from "./marcadores";
export { Tabs, SegmentedControl, type TabDef } from "./tabs";
export { proximoIndice } from "./teclado";
export { DropdownMenu, MenuPreview, type ItemMenu } from "./menu";
export { Tooltip } from "./tooltip";
export { Dialog, SidePanel } from "./dialog";
export { ToastProvider, useToast, ToastPreview, duracaoAviso, type TomAviso } from "./toast";
export { Table, ListRow, ariaSort, proximaOrdem, alternarTodas, useRolagemFocavel, type Coluna, type Ordem } from "./table";
export { EmptyState, NoResults, ErrorState, PermissionState } from "./states";
export { Spinner, Skeleton, SkeletonGroup, SkeletonListRow, SkeletonTableRows } from "./feedback";
export { Panel, PageHeader, FaixaTopo, Breadcrumbs, Toolbar, type Passo } from "./estrutura";
export {
  ChatBubble,
  CallEvent,
  DaySeparator,
  Composer,
  OwnershipBar,
  rotuloLigacao,
  nomeDoAutor,
  type Autor,
  type EstadoEnvio,
  type Condutor,
} from "./conversa";
