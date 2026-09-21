import time
import os
import random
import numpy as np
from PIL import Image as PILImage
from aiohttp import web
from server import PromptServer
import folder_paths
from comfy.model_management import InterruptProcessingException
import comfy.model_management


class ImageOptionPicker:
    status_by_id = {}
    selected_by_id = {}
    # The counter that the frontend can increment via Reload breaks the ComfyUI cache
    reload_token_by_id = {}

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "option_1": ("IMAGE",),
                "option_2": ("IMAGE",),
                "option_3": ("IMAGE",),
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",
            },
        }

    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("selected_image",)
    FUNCTION = "pick"
    CATEGORY = "image/utils"
    OUTPUT_NODE = True

    @classmethod
    def IS_CHANGED(cls, unique_id=None, **kwargs):
        """Always recompute the node; otherwise, with the same inputs, ComfyUI
        returns the cached selection, and the pause no longer triggers.
        Reload increases the token - an extra safeguard."""
        node_id = str(unique_id) if unique_id is not None else ""
        token = cls.reload_token_by_id.get(node_id, 0)
        return f"nan_{token}"

    def save_preview(self, image_tensor, prefix):
        full_output_folder, filename, counter, subfolder, _ = folder_paths.get_save_image_path(
            prefix,
            folder_paths.get_temp_directory(),
            image_tensor.shape[1],
            image_tensor.shape[0]
        )
        i = 255. * image_tensor.cpu().numpy()
        img = PILImage.fromarray(np.clip(i, 0, 255).astype(np.uint8))
        file = f"{filename}_{counter:05}_.png"
        img.save(os.path.join(full_output_folder, file), compress_level=1)
        return {
            "filename": file,
            "subfolder": subfolder,
            "type": "temp"
        }

    def pick(self, option_1, option_2, option_3, unique_id=None):
        node_id = str(unique_id)

        results = [
            self.save_preview(option_1[0], f"opt1_{random.randint(10000,99999)}"),
            self.save_preview(option_2[0], f"opt2_{random.randint(10000,99999)}"),
            self.save_preview(option_3[0], f"opt3_{random.randint(10000,99999)}"),
        ]

        # Without images - so that ComfyUI doesn't render the old grid preview
        PromptServer.instance.send_sync("executed", {
            "node": node_id,
            "output": {},
            "prompt_id": None
        })

        time.sleep(0.25)

        self.status_by_id[node_id] = "paused"
        self.selected_by_id[node_id] = None

        # Images exclusive to our event - for the frontend carousel
        PromptServer.instance.send_sync("image_option_paused", {
            "node_id": node_id,
            "images": results,
        })

        try:
            while self.status_by_id.get(node_id) == "paused":
                if comfy.model_management.processing_interrupted():
                    self.status_by_id[node_id] = "cancelled"
                    break
                time.sleep(0.1)

            if self.status_by_id.get(node_id) == "cancelled":
                raise InterruptProcessingException()

            selected = self.selected_by_id.get(node_id, 1)

            if selected == 1:
                return (option_1,)
            elif selected == 2:
                return (option_2,)
            else:
                return (option_3,)

        finally:
            self.status_by_id.pop(node_id, None)
            self.selected_by_id.pop(node_id, None)


# === API ===

@PromptServer.instance.routes.post("/image_option_picker/select/{node_id}/{option}")
async def select_option(request):
    node_id = request.match_info["node_id"].strip()
    option = int(request.match_info["option"])
    ImageOptionPicker.selected_by_id[node_id] = option
    ImageOptionPicker.status_by_id[node_id] = "continue"
    return web.json_response({"status": "ok"})


@PromptServer.instance.routes.post("/image_option_picker/cancel/{node_id}")
async def cancel_node(request):
    node_id = request.match_info["node_id"].strip()
    ImageOptionPicker.status_by_id[node_id] = "cancelled"
    return web.json_response({"status": "ok"})


@PromptServer.instance.routes.post("/image_option_picker/cancel")
async def cancel_all(request):
    for nid in list(ImageOptionPicker.status_by_id.keys()):
        ImageOptionPicker.status_by_id[nid] = "cancelled"
    return web.json_response({"status": "ok"})


@PromptServer.instance.routes.post("/image_option_picker/reload/{node_id}")
async def reload_node(request):
    """Resets the selection and increases the token - at the next Run node
    will pause the work flow again, even if the pictures are the same."""
    node_id = request.match_info["node_id"].strip()
    ImageOptionPicker.status_by_id[node_id] = "cancelled"
    ImageOptionPicker.selected_by_id.pop(node_id, None)
    ImageOptionPicker.reload_token_by_id[node_id] = (
        ImageOptionPicker.reload_token_by_id.get(node_id, 0) + 1
    )
    return web.json_response({
        "status": "ok",
        "token": ImageOptionPicker.reload_token_by_id[node_id],
    })


NODE_CLASS_MAPPINGS = {
    "ImageOptionPicker": ImageOptionPicker
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "ImageOptionPicker": "🖼️ Image Option Picker (Pause)"
}