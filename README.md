# ImageOptionPicker

> A node to pause the workflow to select one of the three generated images for further processing.
> <img width="317" height="420" alt="iop" src="https://github.com/user-attachments/assets/9136f2d1-e486-46f1-b933-799dcee69a99" />


## 📖 Description

This node takes three images as input, displays them in a preview window, and pauses the workflow. You can cycle through the previews and choose which of the three options to send for further processing.

Click the button with the number of the selected image.

The workflow resumes, and the selected option is sent to the node's output.

Please see a video with example.

## 🎬 Video examples

[![Video example 1](https://img.youtube.com/vi/oGRq9qvV_Nw/0.jpg)](https://www.youtube.com/watch?v=oGRq9qvV_Nw)

[![Video example 2](https://img.youtube.com/vi/FJwyQCf8png/0.jpg)](https://www.youtube.com/watch?v=FJwyQCf8png)

## 📦 Installation

### Manual

```bash
cd ComfyUI/custom_nodes/
git clone https://github.com/lalikamala/ComfyUI-ImageOptionPicker.git
```

Then restart ComfyUI.

### Via ComfyUI Manager

Search for **"Image Option Picker"** in ComfyUI Manager and install.

> ⚠️ **Important:** After installing via ComfyUI Manager, please **fully restart ComfyUI** — close the console window and launch it again. A soft restart (the "Restart" button in Manager) is **not enough**: the JavaScript interface of the node will not load, and the node will appear as an empty rectangle until a full restart.
