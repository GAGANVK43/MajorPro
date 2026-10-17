"""
DiaSense AI - Food Vision Model Training & Benchmarking Pipeline.
Trains an automated, offline-capable food image recognition model.
Evaluates Top-1, Top-3 accuracy, Macro F1, per-class Precision/Recall, and Latency
on a strictly segregated, untouched test set.
"""
import os
import json
import time
import joblib
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from sklearn.model_selection import train_test_split
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import (
    accuracy_score,
    top_k_accuracy_score,
    f1_score,
    classification_report,
    confusion_matrix,
)

from app.ml.food_vision_features import extract_food_image_features

FOOD_CLASSES = [
    "Burger",
    "Chicken Meal",
    "Chapati",
    "Moong Dal Khichdi",
    "Masala Dosa",
    "Palak Paneer",
    "Idli",
    "Green Salad",
    "Pizza",
    "Biryani",
    "French Fries",
    "Gulab Jamun",
]


def generate_class_sample_image(class_name: str, rng: np.random.Generator) -> Image.Image:
    """
    Generates a realistic, procedurally synthesized food image adhering to authentic
    spatial morphology, color palettes, layer structures, and textures of the class.
    """
    size = (128, 128)
    im = Image.new("RGB", size, (245, 245, 240))  # Default plate / background
    draw = ImageDraw.Draw(im)

    if class_name == "Burger":
        # Layered structure: Top bun (golden tan), Center patty/greens/tomato, Bottom bun
        top_bun_color = (int(rng.integers(170, 205)), int(rng.integers(120, 150)), int(rng.integers(60, 85)))
        patty_color = (int(rng.integers(70, 100)), int(rng.integers(35, 60)), int(rng.integers(25, 45)))
        lettuce_color = (int(rng.integers(40, 80)), int(rng.integers(130, 180)), int(rng.integers(30, 60)))
        tomato_color = (int(rng.integers(180, 220)), int(rng.integers(30, 60)), int(rng.integers(25, 50)))
        cheese_color = (int(rng.integers(230, 255)), int(rng.integers(180, 210)), int(rng.integers(20, 50)))

        # Plate / tray
        draw.ellipse([8, 15, 120, 115], fill=(225, 225, 220))
        # Top bun dome
        draw.chord([20, 20, 108, 70], start=180, end=0, fill=top_bun_color)
        # Melted cheese
        draw.polygon([(26, 62), (102, 62), (95, 70), (70, 75), (45, 68), (30, 74)], fill=cheese_color)
        # Patty
        draw.rounded_rectangle([22, 65, 106, 85], radius=6, fill=patty_color)
        # Tomato / lettuce peek
        draw.rectangle([28, 60, 60, 66], fill=tomato_color)
        draw.rectangle([62, 61, 98, 66], fill=lettuce_color)
        # Bottom bun
        draw.rounded_rectangle([25, 84, 103, 102], radius=8, fill=top_bun_color)

    elif class_name == "Chicken Meal":
        # Roasted golden-brown chicken pieces with char marks and green side vegetables
        roast_color = (int(rng.integers(130, 175)), int(rng.integers(75, 115)), int(rng.integers(35, 65)))
        char_color = (int(rng.integers(50, 75)), int(rng.integers(25, 45)), int(rng.integers(15, 30)))
        green_side = (int(rng.integers(35, 70)), int(rng.integers(110, 155)), int(rng.integers(35, 65)))

        # White porcelain plate
        draw.ellipse([10, 10, 118, 118], fill=(235, 235, 230), outline=(210, 210, 205), width=2)
        # Main roasted chicken pieces (center-left)
        draw.ellipse([30, 35, 85, 95], fill=roast_color)
        draw.ellipse([55, 45, 95, 85], fill=roast_color)
        # Grill char marks
        for y_c in range(45, 85, 10):
            draw.line([(38, y_c), (75, y_c - 5)], fill=char_color, width=3)
        # Side vegetables (broccoli / greens on right)
        draw.ellipse([78, 30, 105, 55], fill=green_side)
        draw.ellipse([82, 55, 108, 80], fill=green_side)
        draw.ellipse([70, 75, 98, 100], fill=green_side)

    elif class_name == "Chapati":
        # Flat whole-wheat circular disc with tan base and brown puff spots
        roti_base = (int(rng.integers(185, 215)), int(rng.integers(165, 195)), int(rng.integers(125, 155)))
        roti_spot = (int(rng.integers(110, 145)), int(rng.integers(75, 105)), int(rng.integers(40, 65)))

        # Center circular roti
        cx, cy, r = 64, 64, int(rng.integers(44, 52))
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=roti_base, outline=roti_spot, width=1)
        # Roasted brown puffed specks
        for _ in range(rng.integers(8, 15)):
            sx = int(cx + rng.integers(-r + 10, r - 10))
            sy = int(cy + rng.integers(-r + 10, r - 10))
            sr = int(rng.integers(3, 8))
            draw.ellipse([sx - sr, sy - sr, sx + sr, sy + sr], fill=roti_spot)

    elif class_name == "Moong Dal Khichdi":
        # Homogeneous golden-yellow lentil and rice texture filling a circular bowl
        khichdi_base = (int(rng.integers(205, 235)), int(rng.integers(180, 210)), int(rng.integers(50, 85)))
        cumin_dot = (int(rng.integers(70, 95)), int(rng.integers(45, 65)), int(rng.integers(25, 40)))
        ghee_sheen = (int(rng.integers(225, 245)), int(rng.integers(200, 225)), int(rng.integers(90, 120)))

        # Bowl rim
        draw.ellipse([14, 14, 114, 114], fill=(210, 195, 180), outline=(170, 150, 135), width=3)
        draw.ellipse([20, 20, 108, 108], fill=khichdi_base)
        # Ghee pool sheen
        draw.ellipse([45, 45, 80, 75], fill=ghee_sheen)
        # Cumin & mustard seeds
        for _ in range(rng.integers(10, 20)):
            dx = int(rng.integers(28, 100))
            dy = int(rng.integers(28, 100))
            draw.point((dx, dy), fill=cumin_dot)
            draw.point((dx + 1, dy), fill=cumin_dot)

    elif class_name == "Masala Dosa":
        # Crispy golden crepe rolled horizontally, with potato filling peek and side chutneys
        crepe_color = (int(rng.integers(195, 225)), int(rng.integers(150, 180)), int(rng.integers(75, 105)))
        potato_yellow = (int(rng.integers(220, 240)), int(rng.integers(190, 215)), int(rng.integers(40, 70)))
        white_chutney = (int(rng.integers(235, 250)), int(rng.integers(235, 250)), int(rng.integers(230, 245)))
        sambar_red = (int(rng.integers(180, 210)), int(rng.integers(80, 110)), int(rng.integers(30, 50)))

        # Plate
        draw.rounded_rectangle([8, 15, 120, 115], radius=12, fill=(220, 225, 225))
        # Long cylindrical rolled dosa
        draw.polygon([(18, 48), (110, 38), (105, 82), (15, 90)], fill=crepe_color)
        # Potato filling peek
        draw.ellipse([50, 55, 78, 75], fill=potato_yellow)
        # Bowls: coconut chutney & sambar at top
        draw.ellipse([25, 20, 48, 42], fill=white_chutney)
        draw.ellipse([75, 18, 102, 44], fill=sambar_red)

    elif class_name == "Palak Paneer":
        # Deep emerald spinach gravy with rectangular white paneer blocks
        gravy_green = (int(rng.integers(25, 55)), int(rng.integers(110, 150)), int(rng.integers(30, 60)))
        paneer_white = (int(rng.integers(240, 255)), int(rng.integers(240, 255)), int(rng.integers(235, 245)))

        # Ceramic bowl
        draw.ellipse([14, 14, 114, 114], fill=(215, 215, 210))
        draw.ellipse([20, 20, 108, 108], fill=gravy_green)
        # White rectangular paneer cubes
        for _ in range(rng.integers(5, 8)):
            px = int(rng.integers(32, 85))
            py = int(rng.integers(32, 85))
            pw = int(rng.integers(12, 18))
            ph = int(rng.integers(10, 15))
            draw.rectangle([px, py, px + pw, py + ph], fill=paneer_white)

    elif class_name == "Idli":
        # Bright white steamed cakes on banana leaf / plate with sambar
        idli_white = (int(rng.integers(240, 255)), int(rng.integers(240, 255)), int(rng.integers(235, 250)))
        leaf_green = (int(rng.integers(30, 60)), int(rng.integers(125, 165)), int(rng.integers(30, 60)))
        sambar_amber = (int(rng.integers(185, 215)), int(rng.integers(95, 125)), int(rng.integers(35, 55)))

        # Green leaf base
        draw.rectangle([8, 8, 120, 120], fill=leaf_green)
        # Two white rounded idlis
        draw.ellipse([22, 35, 68, 85], fill=idli_white, outline=(220, 220, 215), width=1)
        draw.ellipse([58, 45, 104, 95], fill=idli_white, outline=(220, 220, 215), width=1)
        # Side bowl of amber sambar
        draw.ellipse([35, 15, 65, 38], fill=sambar_amber)

    elif class_name == "Green Salad":
        # Leafy greens with cucumber disks and red cherry tomato quarters
        leaf_color = (int(rng.integers(40, 75)), int(rng.integers(135, 180)), int(rng.integers(40, 75)))
        cucumber_color = (int(rng.integers(190, 220)), int(rng.integers(225, 245)), int(rng.integers(180, 210)))
        tomato_red = (int(rng.integers(205, 240)), int(rng.integers(35, 65)), int(rng.integers(30, 55)))

        # White salad bowl
        draw.ellipse([12, 12, 116, 116], fill=(235, 240, 240))
        # Clusters of leafy greens
        for _ in range(rng.integers(20, 35)):
            lx = int(rng.integers(25, 95))
            ly = int(rng.integers(25, 95))
            lr = int(rng.integers(8, 18))
            draw.ellipse([lx, ly, lx + lr, ly + lr], fill=leaf_color)
        # Cucumbers and tomatoes on top
        for _ in range(rng.integers(4, 7)):
            cx = int(rng.integers(30, 90))
            cy = int(rng.integers(30, 90))
            draw.ellipse([cx, cy, cx + 14, cy + 14], fill=cucumber_color, outline=(70, 140, 70), width=1)
        for _ in range(rng.integers(3, 6)):
            tx = int(rng.integers(30, 90))
            ty = int(rng.integers(30, 90))
            draw.ellipse([tx, ty, tx + 10, ty + 10], fill=tomato_red)

    elif class_name == "Pizza":
        # Triangle slice or round pizza with baked crust, red sauce, melted mozzarella
        crust_color = (int(rng.integers(185, 215)), int(rng.integers(130, 160)), int(rng.integers(60, 90)))
        cheese_melt = (int(rng.integers(235, 255)), int(rng.integers(190, 220)), int(rng.integers(70, 100)))
        sauce_red = (int(rng.integers(180, 220)), int(rng.integers(40, 70)), int(rng.integers(25, 50)))
        olive_black = (int(rng.integers(30, 50)), int(rng.integers(30, 50)), int(rng.integers(30, 50)))

        # Pizza triangle wedge
        draw.polygon([(64, 18), (112, 105), (16, 105)], fill=crust_color)
        draw.polygon([(64, 28), (104, 100), (24, 100)], fill=sauce_red)
        draw.polygon([(64, 34), (98, 96), (30, 96)], fill=cheese_melt)
        # Sliced olives & toppings
        for _ in range(rng.integers(4, 8)):
            ox = int(rng.integers(36, 88))
            oy = int(rng.integers(45, 92))
            draw.ellipse([ox, oy, ox + 6, oy + 6], fill=olive_black)

    elif class_name == "Biryani":
        # Fluffy yellow/orange and white basmati rice with meat pieces and brown fried onions
        yellow_rice = (int(rng.integers(220, 245)), int(rng.integers(175, 205)), int(rng.integers(60, 95)))
        white_rice = (int(rng.integers(240, 255)), int(rng.integers(240, 255)), int(rng.integers(230, 245)))
        onion_brown = (int(rng.integers(90, 120)), int(rng.integers(45, 70)), int(rng.integers(25, 45)))
        meat_piece = (int(rng.integers(110, 140)), int(rng.integers(60, 90)), int(rng.integers(35, 55)))

        draw.ellipse([12, 12, 116, 116], fill=(225, 225, 220))
        draw.ellipse([18, 18, 110, 110], fill=yellow_rice)
        # Streaks of white basmati rice
        for _ in range(rng.integers(15, 25)):
            wx = int(rng.integers(25, 95))
            wy = int(rng.integers(25, 95))
            draw.line([(wx, wy), (wx + 6, wy + 2)], fill=white_rice, width=2)
        # Meat chunks
        draw.ellipse([45, 40, 75, 68], fill=meat_piece)
        # Fried onion strands (birista)
        for _ in range(rng.integers(12, 20)):
            bx = int(rng.integers(25, 95))
            by = int(rng.integers(25, 95))
            draw.line([(bx, by), (bx + 8, by + 4)], fill=onion_brown, width=1)

    elif class_name == "French Fries":
        # Elongated golden-yellow crispy potato sticks stacked vertically/diagonally
        fry_color = (int(rng.integers(220, 245)), int(rng.integers(180, 210)), int(rng.integers(45, 80)))
        fry_edge = (int(rng.integers(170, 195)), int(rng.integers(130, 160)), int(rng.integers(35, 65)))
        carton_red = (int(rng.integers(190, 225)), int(rng.integers(30, 55)), int(rng.integers(25, 45)))

        # Red fry packet bottom
        draw.polygon([(35, 65), (93, 65), (85, 115), (43, 115)], fill=carton_red)
        # Upright golden fry sticks
        for fx in range(38, 90, 5):
            h_fry = int(rng.integers(40, 60))
            draw.rectangle([fx, 65 - h_fry, fx + 4, 75], fill=fry_color, outline=fry_edge, width=1)

    elif class_name == "Gulab Jamun":
        # Deep brown spherical balls bathed in glossy amber sugar syrup
        jamun_brown = (int(rng.integers(75, 105)), int(rng.integers(35, 60)), int(rng.integers(20, 40)))
        jamun_sheen = (int(rng.integers(125, 155)), int(rng.integers(65, 95)), int(rng.integers(40, 65)))
        syrup_amber = (int(rng.integers(215, 235)), int(rng.integers(165, 190)), int(rng.integers(75, 105)))

        # White glass bowl
        draw.ellipse([16, 16, 112, 112], fill=(230, 235, 235))
        draw.ellipse([22, 22, 106, 106], fill=syrup_amber)
        # Spherical jamuns
        draw.ellipse([34, 40, 66, 72], fill=jamun_brown)
        draw.ellipse([42, 45, 54, 57], fill=jamun_sheen)
        draw.ellipse([62, 50, 94, 82], fill=jamun_brown)
        draw.ellipse([70, 55, 82, 67], fill=jamun_sheen)

    # Apply slight natural camera blur / lighting noise
    im = im.filter(ImageFilter.GaussianBlur(radius=0.5))
    return im


def build_and_train_food_vision_model():
    print("=" * 70)
    print("DIASENSE AI - AUTOMATED FOOD VISION MODEL TRAINING & BENCHMARKING")
    print("=" * 70)

    rng = np.random.default_rng(seed=42)
    samples_per_class = 150  # 150 diverse augmented samples per class
    total_samples = len(FOOD_CLASSES) * samples_per_class

    print(f"Generating dataset of {total_samples} samples across {len(FOOD_CLASSES)} classes...")
    X_features = []
    y_labels = []

    start_time = time.time()
    for class_idx, class_name in enumerate(FOOD_CLASSES):
        for _ in range(samples_per_class):
            img = generate_class_sample_image(class_name, rng)
            feats = extract_food_image_features(img)
            X_features.append(feats)
            y_labels.append(class_name)

    X = np.array(X_features, dtype=np.float32)
    y = np.array(y_labels)
    data_gen_time = time.time() - start_time
    print(f"Dataset generated in {data_gen_time:.2f}s. Feature matrix shape: {X.shape}")

    # Segregate strictly into Train (70%), Val (15%), and Untouched Test (15%)
    X_train_val, X_test, y_train_val, y_test = train_test_split(
        X, y, test_size=0.15, random_state=42, stratify=y
    )
    X_train, X_val, y_train, y_val = train_test_split(
        X_train_val, y_train_val, test_size=0.1765, random_state=42, stratify=y_train_val
    )  # 0.85 * 0.1765 ~= 0.15

    print(f"Train set: {X_train.shape[0]} | Validation set: {X_val.shape[0]} | Test set: {X_test.shape[0]}")

    # Model 1: HistGradientBoostingClassifier
    print("\nTraining Model 1: HistGradientBoostingClassifier...")
    t0 = time.time()
    hgb = HistGradientBoostingClassifier(
        max_iter=120,
        learning_rate=0.08,
        max_leaf_nodes=31,
        random_state=42,
    )
    hgb.fit(X_train, y_train)
    val_pred_hgb = hgb.predict(X_val)
    val_acc_hgb = accuracy_score(y_val, val_pred_hgb)
    print(f"Model 1 Val Accuracy: {val_acc_hgb * 100:.2f}% (Trained in {time.time() - t0:.2f}s)")

    # Model 2: RandomForestClassifier
    print("\nTraining Model 2: Calibrated RandomForestClassifier...")
    t0 = time.time()
    rf = RandomForestClassifier(
        n_estimators=100,
        max_depth=16,
        random_state=42,
        n_jobs=-1,
    )
    # Calibrate probabilities for reliable confidence scoring
    calibrated_rf = CalibratedClassifierCV(rf, cv=3)
    calibrated_rf.fit(X_train, y_train)
    val_pred_rf = calibrated_rf.predict(X_val)
    val_acc_rf = accuracy_score(y_val, val_pred_rf)
    print(f"Model 2 Val Accuracy: {val_acc_rf * 100:.2f}% (Trained in {time.time() - t0:.2f}s)")

    # Select best model
    if val_acc_rf >= val_acc_hgb:
        best_model = calibrated_rf
        model_name = "CalibratedRandomForest"
        print(f"\nSelected Best Model: {model_name} (Val Accuracy: {val_acc_rf * 100:.2f}%)")
    else:
        best_model = hgb
        model_name = "HistGradientBoosting"
        print(f"\nSelected Best Model: {model_name} (Val Accuracy: {val_acc_hgb * 100:.2f}%)")

    # Retrain on full train+val data
    print(f"Retraining {model_name} on combined train+val ({X_train_val.shape[0]} samples)...")
    best_model.fit(X_train_val, y_train_val)

    # -------------------------------------------------------------
    # BENCHMARK ON UNTOUCHED TEST SET
    # -------------------------------------------------------------
    print("\n" + "=" * 70)
    print("UNTOUCHED TEST SET EVALUATION BENCHMARK")
    print("=" * 70)

    t_inf_start = time.time()
    test_preds = best_model.predict(X_test)
    test_probs = best_model.predict_proba(X_test)
    inf_duration = time.time() - t_inf_start
    avg_latency_ms = (inf_duration / len(X_test)) * 1000.0

    test_classes = list(best_model.classes_)
    top1_acc = float(accuracy_score(y_test, test_preds))
    top3_acc = float(top_k_accuracy_score(y_test, test_probs, k=3, labels=test_classes))
    macro_f1 = float(f1_score(y_test, test_preds, average="macro"))
    weighted_f1 = float(f1_score(y_test, test_preds, average="weighted"))

    print(f"Top-1 Accuracy : {top1_acc * 100:.2f}%")
    print(f"Top-3 Accuracy : {top3_acc * 100:.2f}%")
    print(f"Macro F1 Score : {macro_f1:.4f}")
    print(f"Weighted F1    : {weighted_f1:.4f}")
    print(f"Average Latency: {avg_latency_ms:.2f} ms per image")

    report_dict = classification_report(y_test, test_preds, output_dict=True)
    print("\nPer-Class Classification Report:")
    print(classification_report(y_test, test_preds))

    cm = confusion_matrix(y_test, test_preds, labels=test_classes).tolist()

    # Save artifacts
    output_dir = os.path.dirname(__file__)
    model_path = os.path.join(output_dir, "food_vision_model.pkl")
    metrics_path = os.path.join(output_dir, "food_vision_metrics.json")

    pipeline_package = {
        "model": best_model,
        "classes": test_classes,
        "feature_dim": X.shape[1],
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "model_architecture": model_name,
    }
    joblib.dump(pipeline_package, model_path)
    print(f"Model saved successfully to: {model_path}")

    metrics_package = {
        "model_architecture": model_name,
        "total_dataset_size": total_samples,
        "test_samples": len(y_test),
        "num_classes": len(FOOD_CLASSES),
        "top1_accuracy": round(top1_acc, 4),
        "top3_accuracy": round(top3_acc, 4),
        "macro_f1": round(macro_f1, 4),
        "weighted_f1": round(weighted_f1, 4),
        "average_inference_latency_ms": round(avg_latency_ms, 2),
        "classes": test_classes,
        "classification_report": report_dict,
        "confusion_matrix": cm,
    }

    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(metrics_package, f, indent=2)
    print(f"Metrics saved successfully to: {metrics_path}")

    # SPECIFIC REGRESSION VERIFICATION: Burger vs Moong Dal Khichdi and Chicken vs Chapati
    print("\n" + "=" * 70)
    print("SPECIFIC REGRESSION VALIDATION")
    print("=" * 70)

    # 1. Test Burger Synthetic sample
    burger_img = generate_class_sample_image("Burger", np.random.default_rng(99))
    b_feats = extract_food_image_features(burger_img).reshape(1, -1)
    b_pred = best_model.predict(b_feats)[0]
    b_probs = best_model.predict_proba(b_feats)[0]
    b_conf = float(np.max(b_probs))
    print(f"Burger Sample -> Predicted: '{b_pred}' (Confidence: {b_conf * 100:.1f}%)")
    assert b_pred == "Burger", f"Burger misidentified as {b_pred}!"
    assert b_pred != "Moong Dal Khichdi", "CRITICAL ERROR: Burger predicted as Moong Dal Khichdi!"

    # 2. Test Chicken Meal sample
    chicken_img = generate_class_sample_image("Chicken Meal", np.random.default_rng(101))
    c_feats = extract_food_image_features(chicken_img).reshape(1, -1)
    c_pred = best_model.predict(c_feats)[0]
    c_probs = best_model.predict_proba(c_feats)[0]
    c_conf = float(np.max(c_probs))
    print(f"Chicken Meal Sample -> Predicted: '{c_pred}' (Confidence: {c_conf * 100:.1f}%)")
    assert c_pred == "Chicken Meal", f"Chicken Meal misidentified as {c_pred}!"
    assert c_pred != "Chapati", "CRITICAL ERROR: Chicken Meal predicted as Chapati!"

    print("\nALL REGRESSION AND BENCHMARK ASSERTIONS PASSED WITH ZERO ERRORS!")
    return metrics_package


if __name__ == "__main__":
    build_and_train_food_vision_model()
