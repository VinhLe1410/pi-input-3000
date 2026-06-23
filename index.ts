import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerInputStyleLifecycle } from "./ui/input-style-lifecycle";
import { InputStyleRuntimeController } from "./ui/input-style-runtime";
import installStickyInput from "./ui/sticky/controller";

export default function (pi: ExtensionAPI) {
  installStickyInput(pi);
  registerInputStyleLifecycle(pi, new InputStyleRuntimeController());
}
