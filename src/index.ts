import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerInputStyleLifecycle } from "./lifecycle";
import { InputStyleRuntimeController } from "./runtime";
import installStickyInput from "./sticky/install-sticky-input";

export default function (pi: ExtensionAPI) {
  installStickyInput(pi);
  registerInputStyleLifecycle(pi, new InputStyleRuntimeController());
}
