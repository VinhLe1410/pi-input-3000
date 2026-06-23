import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { loadInputStyleConfig } from "./config";
import { registerInputStyleLifecycle } from "./lifecycle";
import { InputStyleRuntimeController } from "./runtime";
import installStickyInput from "./sticky/install-sticky-input";

export default function (pi: ExtensionAPI) {
  const stickyInput = installStickyInput(pi, {
    isEnabled: () => loadInputStyleConfig().stickyInput,
  });

  registerInputStyleLifecycle(
    pi,
    new InputStyleRuntimeController(),
    stickyInput,
  );
}
