import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { InputFlowController } from "./runtime";

export default function (pi: ExtensionAPI) {
  new InputFlowController(pi).register();
}
