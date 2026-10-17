"""
DiaSense AI - Food Vision Feature Extraction Engine.
Extracts rich, scale-invariant, spatial-color, texture, and morphological features
from food images to enable fast, local, offline machine-learning classification.
"""
import numpy as np
from PIL import Image, ImageOps
from scipy import ndimage


def extract_food_image_features(pil_img: Image.Image) -> np.ndarray:
    """
    Extracts a 70-dimensional feature vector from a PIL Image:
    - Global Color Moments (RGB + HSV)
    - Spatial Multi-Region Profiles (Horizontal Top/Mid/Bottom bands + Center/Margin)
    - Texture, Gradient Magnitude & Edge Density (Sobel filters)
    - Channel Color Histograms
    """
    # 1. Normalize image orientation and resize to standardized 128x128
    img = ImageOps.exif_transpose(pil_img).convert("RGB")
    img = img.resize((128, 128), Image.Resampling.BILINEAR)
    arr = np.array(img, dtype=np.float32)

    features = []

    # ---------------------------------------------------------
    # A. Global RGB Moments (9 features)
    # ---------------------------------------------------------
    mean_rgb = arr.mean(axis=(0, 1))
    std_rgb = arr.std(axis=(0, 1))
    # Approximate skewness
    skew_rgb = np.mean(((arr - mean_rgb) / (std_rgb + 1e-5)) ** 3, axis=(0, 1))
    features.extend(mean_rgb / 255.0)
    features.extend(std_rgb / 128.0)
    features.extend(np.clip(skew_rgb, -3.0, 3.0) / 3.0)

    # ---------------------------------------------------------
    # B. Global HSV Moments (6 features)
    # ---------------------------------------------------------
    hsv_img = img.convert("HSV")
    hsv_arr = np.array(hsv_img, dtype=np.float32)
    mean_hsv = hsv_arr.mean(axis=(0, 1))
    std_hsv = hsv_arr.std(axis=(0, 1))
    features.extend(mean_hsv / 255.0)
    features.extend(std_hsv / 128.0)

    # ---------------------------------------------------------
    # C. Spatial Layer Profiles (Top 30%, Middle 40%, Bottom 30%) (18 features)
    # Distinctively captures layered foods (Burgers, Sandwiches, Toppings)
    # vs uniform dishes (Khichdi, Dal, Soups)
    # ---------------------------------------------------------
    h = arr.shape[0]
    top_band = arr[: int(h * 0.30), :, :]
    mid_band = arr[int(h * 0.30) : int(h * 0.70), :, :]
    bot_band = arr[int(h * 0.70) :, :, :]

    for band in (top_band, mid_band, bot_band):
        features.extend(band.mean(axis=(0, 1)) / 255.0)
        features.extend(band.std(axis=(0, 1)) / 128.0)

    # ---------------------------------------------------------
    # D. Spatial Center vs. Margin Contrast (6 features)
    # Distinguishes centered plate dishes from full-bleed or rimmed plates
    # ---------------------------------------------------------
    center_box = arr[32:96, 32:96, :]
    margin_mask = np.ones((128, 128), dtype=bool)
    margin_mask[32:96, 32:96] = False
    margin_pixels = arr[margin_mask, :]

    features.extend(center_box.mean(axis=(0, 1)) / 255.0)
    features.extend(margin_pixels.mean(axis=0) / 255.0)

    # ---------------------------------------------------------
    # E. Gradients, Edge Density & Texture Complexity (4 features)
    # Distinguishes salads, fries, and burgers from smooth curries and porridges
    # ---------------------------------------------------------
    gray = 0.2989 * arr[:, :, 0] + 0.5870 * arr[:, :, 1] + 0.1140 * arr[:, :, 2]
    sobel_x = ndimage.sobel(gray, axis=1)
    sobel_y = ndimage.sobel(gray, axis=0)
    grad_mag = np.hypot(sobel_x, sobel_y)

    grad_mean = float(np.mean(grad_mag))
    grad_std = float(np.std(grad_mag))
    grad_p90 = float(np.percentile(grad_mag, 90))
    edge_density = float(np.mean(grad_mag > 30.0))  # Proportion of strong edge pixels

    features.append(grad_mean / 255.0)
    features.append(grad_std / 255.0)
    features.append(grad_p90 / 255.0)
    features.append(edge_density)

    # ---------------------------------------------------------
    # F. Color Histograms (8 bins per channel = 24 features)
    # ---------------------------------------------------------
    for c in range(3):
        hist, _ = np.histogram(arr[:, :, c], bins=8, range=(0, 256), density=True)
        features.extend(hist * 32.0)  # Scale to reasonable range

    # ---------------------------------------------------------
    # G. Local Texture Variance (3 features)
    # ---------------------------------------------------------
    uniform_filter = ndimage.uniform_filter(gray, size=5)
    local_var = ndimage.uniform_filter(gray**2, size=5) - uniform_filter**2
    features.append(float(np.mean(local_var)) / 1000.0)
    features.append(float(np.std(local_var)) / 1000.0)
    features.append(float(np.percentile(local_var, 80)) / 1000.0)

    return np.array(features, dtype=np.float32)
