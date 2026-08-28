import "./DietPlan.css";
import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import Navbar from "../../components/Navbar/Navbar";
import BackButton from "../../components/BackButton/BackButton";
import Footer from "../../components/Footer/Footer";
import { Link } from "react-router-dom";
import { FaUtensils, FaCheckCircle, FaRunning, FaLeaf, FaDrumstickBite, FaBullseye, FaTint, FaWalking, FaAppleAlt, FaHeartbeat, FaBrain, FaExclamationTriangle, FaFire, FaTrophy, FaArrowRight, FaLock, FaClipboardList, FaSpinner } from "react-icons/fa";
import { dietService, predictionService } from "../../services/api";

function DietPlan() {
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const [activeDay, setActiveDay] = useState("Monday");
  const [dietType, setDietType] = useState("Vegetarian");
  const [loading, setLoading] = useState(true);
  const [hasAssessment, setHasAssessment] = useState(false);
  const [patientStatus, setPatientStatus] = useState(null);

  const todayKey = new Date().toISOString().split("T")[0];

  // Get current logged-in user ID to isolate streak per user
  const getUserId = () => {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      return user.id || user.email || "guest";
    } catch {
      return "guest";
    }
  };
  const userId = getUserId();

  // User-specific localStorage keys
  const streakKey  = `diasense_health_streak_${userId}`;
  const claimedKey = `diasense_streak_claimed_${userId}_${todayKey}`;
  const goalsKey   = `diasense_goals_${userId}_${todayKey}`;

  // Persistent Streak Counter State — user-specific (starts at 0 for new users)
  const [streakCount, setStreakCount] = useState(() => {
    const savedStreak = localStorage.getItem(streakKey);
    return savedStreak ? parseInt(savedStreak, 10) : 0;
  });

  // Has streak/tasks already been completed and claimed today? — user-specific
  const [streakClaimed, setStreakClaimed] = useState(() => {
    return localStorage.getItem(claimedKey) === "true";
  });

  // Persistent Goal State for Today — user-specific
  const [dailyGoals, setDailyGoals] = useState(() => {
    const isClaimedToday = localStorage.getItem(claimedKey) === "true";
    if (isClaimedToday) {
      return { water: true, steps: true, fiber: true, glucose: true };
    }
    const saved = localStorage.getItem(goalsKey);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return { water: false, steps: false, fiber: false, glucose: false };
  });

  // Save Goals to localStorage whenever updated
  useEffect(() => {
    if (!streakClaimed) {
      localStorage.setItem(goalsKey, JSON.stringify(dailyGoals));
    }
  }, [dailyGoals, goalsKey, streakClaimed]);

  useEffect(() => {
    let found = false;

    // 1. Read stored prediction from localStorage
    const stored = localStorage.getItem("latest_prediction");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed && (parsed.prediction || parsed.risk_percentage !== undefined)) {
          setPatientStatus({
            prediction: parsed.prediction || (parsed.risk_percentage >= 50 ? "Diabetic" : "Non-Diabetic"),
            risk_percentage: parsed.risk_percentage ?? 5.5,
            glucose: parsed.glucose ?? parsed.raw_inputs?.glucose ?? 110,
            bmi: parsed.bmi ?? parsed.raw_inputs?.bmi ?? 23.5,
          });
          setHasAssessment(true);
          found = true;
        }
      } catch (e) {}
    }

    // 2. Fetch latest prediction from API
    predictionService
      .getLatest()
      .then((res) => {
        const data = res?.data || res;
        if (data && (data.prediction || data.risk_percentage !== undefined)) {
          setPatientStatus({
            prediction: data.prediction,
            risk_percentage: data.risk_percentage,
            glucose: data.glucose || data.raw_inputs?.glucose || 110,
            bmi: data.bmi || data.raw_inputs?.bmi || 23.5,
          });
          setHasAssessment(true);
        } else if (!found) {
          setHasAssessment(false);
        }
      })
      .catch(() => {
        if (!found) {
          setHasAssessment(false);
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const toggleGoal = (key) => {
    if (streakClaimed) {
      toast.info("✅ You have already completed today's daily tasks! New targets unlock tomorrow.");
      return;
    }
    setDailyGoals((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      return updated;
    });
  };

  const completedGoalsCount = streakClaimed ? 4 : Object.values(dailyGoals).filter(Boolean).length;
  const goalProgressPercentage = (completedGoalsCount / 4) * 100;
  const isAllGoalsCompleted = completedGoalsCount === 4;

  const handleClaimStreakAndNextDay = () => {
    if (streakClaimed) {
      toast.info("You have already claimed today's streak! Come back tomorrow for the next day's tasks.");
      return;
    }

    const newStreak = streakCount + 1;
    setStreakCount(newStreak);
    localStorage.setItem(streakKey, newStreak.toString());

    setStreakClaimed(true);
    localStorage.setItem(claimedKey, "true");

    // Lock all goals as completed for today
    const completedAll = { water: true, steps: true, fiber: true, glucose: true };
    setDailyGoals(completedAll);
    localStorage.setItem(goalsKey, JSON.stringify(completedAll));

    toast.success(`🔥 Streak Upgraded to ${newStreak} Days! You have completed today's daily tasks! 🎉`);
  };

  const isHighRisk = patientStatus?.prediction === "Diabetic" || (patientStatus?.risk_percentage >= 50.0);
  const isModerateRisk = !isHighRisk && (patientStatus?.risk_percentage >= 25.0);

  // 1. High Risk / Diabetic Meal Schedules (<45 GI strict control)
  const weeklyDietDataVegHigh = {
    Monday: {
      breakfast: "Oats & Ragi Dosa (2 pcs) with Mint Chutney & Paneer Bhurji (GI < 45).",
      breakfastCal: "310 kcal (Carbs: 38g, Protein: 16g, Fats: 7g)",
      lunch: "Moong Dal & Spinach Khichdi with Cucumber Raita & Sprouted Chana Salad.",
      lunchCal: "460 kcal (Carbs: 58g, Protein: 19g, Fats: 8g)",
      dinner: "Palak Paneer with 2 Bajra/Multigrain Rotis & Steamed Lauki Subzi.",
      dinnerCal: "390 kcal (Carbs: 40g, Protein: 20g, Fats: 10g)",
    },
    Tuesday: {
      breakfast: "Vegetable Oats Upma with Peanuts, Curry Leaves & Curd.",
      breakfastCal: "290 kcal (Carbs: 36g, Protein: 11g, Fats: 6g)",
      lunch: "Brown Rice Bowl with Rajma Curry, Roasted Cauliflower & Salad.",
      lunchCal: "490 kcal (Carbs: 58g, Protein: 20g, Fats: 9g)",
      dinner: "Tofu Tikka with Grilled Vegetables & 1 Whole Wheat Chapati.",
      dinnerCal: "370 kcal (Carbs: 30g, Protein: 24g, Fats: 11g)",
    },
    Wednesday: {
      breakfast: "Moong Dal Chilla (2 pcs) with Tomato-Garlic Chutney & Green Tea.",
      breakfastCal: "300 kcal (Carbs: 34g, Protein: 17g, Fats: 5g)",
      lunch: "Jowar/Millet Roti (2 pcs) with Mixed Veg Korma & Boiled Chana Salad.",
      lunchCal: "470 kcal (Carbs: 52g, Protein: 18g, Fats: 8g)",
      dinner: "Clear Lauki-Tomato Soup with Sautéed Mushroom & Sprouted Beans.",
      dinnerCal: "340 kcal (Carbs: 26g, Protein: 16g, Fats: 5g)",
    },
    Thursday: {
      breakfast: "Steamed Ragi Idli (2 pcs) with Vegetable Sambar & Flax Seeds.",
      breakfastCal: "280 kcal (Carbs: 42g, Protein: 10g, Fats: 4g)",
      lunch: "Brown Rice with Dal Tadka, Bhindi Subzi & Cucumber Salad.",
      lunchCal: "480 kcal (Carbs: 58g, Protein: 17g, Fats: 7g)",
      dinner: "Multigrain Chapati (2 pcs) with Soya Chunk Curry & Curd.",
      dinnerCal: "400 kcal (Carbs: 44g, Protein: 25g, Fats: 9g)",
    },
    Friday: {
      breakfast: "Methi Paratha (1 pc with curd) & Flax Seed Water.",
      breakfastCal: "310 kcal (Carbs: 38g, Protein: 12g, Fats: 8g)",
      lunch: "Quinoa Pulao with Mixed Vegetables, Sprouted Moong Salad & Curd.",
      lunchCal: "470 kcal (Carbs: 52g, Protein: 19g, Fats: 9g)",
      dinner: "Baingan Bharta with 2 Ragi Rotis & Mixed Sprouts Chaat.",
      dinnerCal: "360 kcal (Carbs: 40g, Protein: 15g, Fats: 6g)",
    },
    Saturday: {
      breakfast: "Vegetable Poha with Roasted Peanuts & Lemon Juice.",
      breakfastCal: "290 kcal (Carbs: 40g, Protein: 9g, Fats: 6g)",
      lunch: "Chole Curry with Brown Rice, Cabbage Subzi & Raita.",
      lunchCal: "510 kcal (Carbs: 60g, Protein: 20g, Fats: 10g)",
      dinner: "Grilled Cottage Cheese (Paneer) Steak with Steamed Broccoli.",
      dinnerCal: "350 kcal (Carbs: 20g, Protein: 24g, Fats: 11g)",
    },
    Sunday: {
      breakfast: "Besan Chilla with Grated Carrots & Green Tea.",
      breakfastCal: "300 kcal (Carbs: 32g, Protein: 15g, Fats: 7g)",
      lunch: "Vegetable Brown Rice Pulao & Boondi Raita.",
      lunchCal: "520 kcal (Carbs: 62g, Protein: 19g, Fats: 9g)",
      dinner: "Clear Lentil Soup with Boiled Sweet Potato & Sautéed Spinach.",
      dinnerCal: "330 kcal (Carbs: 34g, Protein: 17g, Fats: 4g)",
    },
  };

  const weeklyDietDataNonVegHigh = {
    Monday: {
      breakfast: "Egg Bhurji (2 Eggs) with 1 Whole Wheat Roti & Green Tea.",
      breakfastCal: "320 kcal (Carbs: 22g, Protein: 22g, Fats: 11g)",
      lunch: "Tandoori Chicken Breast with Quinoa Pulao, Spinach Salad & Raita.",
      lunchCal: "510 kcal (Carbs: 38g, Protein: 40g, Fats: 12g)",
      dinner: "Grilled Fish Curry with 2 Bajra Rotis & Steamed Vegetables.",
      dinnerCal: "410 kcal (Carbs: 30g, Protein: 34g, Fats: 9g)",
    },
    Tuesday: {
      breakfast: "Boiled Egg White Salad (3 eggs) with Oats Toast & Almonds.",
      breakfastCal: "290 kcal (Carbs: 25g, Protein: 24g, Fats: 5g)",
      lunch: "Chicken Curry with Brown Rice, Cucumber Raita & Salad.",
      lunchCal: "530 kcal (Carbs: 48g, Protein: 37g, Fats: 12g)",
      dinner: "Clear Chicken Soup with Steamed Broccoli & Lauki Subzi.",
      dinnerCal: "350 kcal (Carbs: 16g, Protein: 32g, Fats: 7g)",
    },
    Wednesday: {
      breakfast: "Oatmeal with chia seeds, 1 Boiled Egg & Green Tea.",
      breakfastCal: "310 kcal (Carbs: 34g, Protein: 17g, Fats: 7g)",
      lunch: "Fish Shallow Fry (Olive Oil) with Moong Dal & Brown Rice.",
      lunchCal: "490 kcal (Carbs: 45g, Protein: 36g, Fats: 10g)",
      dinner: "Grilled Chicken Breast Tikka with Cucumber Salad & Ragi Roti.",
      dinnerCal: "380 kcal (Carbs: 25g, Protein: 38g, Fats: 8g)",
    },
    Thursday: {
      breakfast: "Scrambled Eggs with Spinach & 1 Ragi Paratha.",
      breakfastCal: "310 kcal (Carbs: 24g, Protein: 20g, Fats: 10g)",
      lunch: "Egg Curry (2 eggs) with Brown Rice & Sprouted Chana Salad.",
      lunchCal: "480 kcal (Carbs: 42g, Protein: 25g, Fats: 11g)",
      dinner: "Tandoori Chicken Tikka with Steamed Asparagus & Salad.",
      dinnerCal: "370 kcal (Carbs: 15g, Protein: 40g, Fats: 9g)",
    },
    Friday: {
      breakfast: "Egg White Omelette with Mushrooms, Bell Peppers & Toast.",
      breakfastCal: "280 kcal (Carbs: 18g, Protein: 25g, Fats: 6g)",
      lunch: "Grilled Fish Fillet with Quinoa, Roasted Vegetables & Curd.",
      lunchCal: "470 kcal (Carbs: 35g, Protein: 37g, Fats: 9g)",
      dinner: "Chicken Clear Soup with 1 Multigrain Chapati & Subzi.",
      dinnerCal: "350 kcal (Carbs: 25g, Protein: 30g, Fats: 7g)",
    },
    Saturday: {
      breakfast: "Moong Dal Chilla with 1 Boiled Egg & Green Chutney.",
      breakfastCal: "290 kcal (Carbs: 28g, Protein: 19g, Fats: 6g)",
      lunch: "Chicken Stew with Brown Rice & Cucumber Salad.",
      lunchCal: "530 kcal (Carbs: 46g, Protein: 38g, Fats: 13g)",
      dinner: "Pan-Seared Fish Fillet with Steamed Beans & Cauliflower Mash.",
      dinnerCal: "340 kcal (Carbs: 12g, Protein: 34g, Fats: 8g)",
    },
    Sunday: {
      breakfast: "Egg Bhurji with Methi Roti & Green Tea.",
      breakfastCal: "310 kcal (Carbs: 22g, Protein: 22g, Fats: 10g)",
      lunch: "Healthy Chicken Biryani (Brown Rice) & Cucumber Raita.",
      lunchCal: "550 kcal (Carbs: 52g, Protein: 38g, Fats: 12g)",
      dinner: "Clear Chicken Soup with Boiled Sprouts & Salad.",
      dinnerCal: "330 kcal (Carbs: 16g, Protein: 32g, Fats: 6g)",
    },
  };

  // 2. Moderate Risk / Pre-Diabetic Meal Schedules (<55 GI Stabilization)
  const weeklyDietDataVegMod = {
    Monday: {
      breakfast: "Vegetable Oats Dosa with Coconut Mint Chutney & Boiled Sprouts.",
      breakfastCal: "330 kcal (Carbs: 42g, Protein: 14g, Fats: 8g)",
      lunch: "Brown Rice with Yellow Dal Tadka, Lauki Subzi & Curd.",
      lunchCal: "480 kcal (Carbs: 62g, Protein: 17g, Fats: 9g)",
      dinner: "2 Jowar Rotis with Paneer Bhurji & Mixed Cucumber Salad.",
      dinnerCal: "380 kcal (Carbs: 44g, Protein: 18g, Fats: 10g)",
    },
    Tuesday: {
      breakfast: "Besan Chilla with Grated Paneer & Buttermilk.",
      breakfastCal: "320 kcal (Carbs: 35g, Protein: 16g, Fats: 8g)",
      lunch: "Multigrain Chapati (2 pcs) with Rajma Curry & Beetroot Salad.",
      lunchCal: "500 kcal (Carbs: 64g, Protein: 19g, Fats: 9g)",
      dinner: "Grilled Tofu Salad with Olive Oil & 1 Multigrain Roti.",
      dinnerCal: "360 kcal (Carbs: 34g, Protein: 20g, Fats: 10g)",
    },
    Wednesday: {
      breakfast: "Ragi Upma with Sautéed Carrots, Beans & Green Tea.",
      breakfastCal: "300 kcal (Carbs: 40g, Protein: 10g, Fats: 6g)",
      lunch: "Brown Rice with Mix Veg Sambar & Sprouted Moong Salad.",
      lunchCal: "470 kcal (Carbs: 58g, Protein: 16g, Fats: 7g)",
      dinner: "Clear Vegetable Soup with 2 Bajra Rotis & Methi Dal.",
      dinnerCal: "370 kcal (Carbs: 42g, Protein: 17g, Fats: 8g)",
    },
    Thursday: {
      breakfast: "Moong Dal Idli (3 pcs) with Tomato Chutney & Almonds.",
      breakfastCal: "310 kcal (Carbs: 38g, Protein: 15g, Fats: 6g)",
      lunch: "Jowar Roti (2 pcs) with Chana Masala & Cucumber Raita.",
      lunchCal: "490 kcal (Carbs: 56g, Protein: 18g, Fats: 9g)",
      dinner: "Soya Chunk Pulao (Brown Rice) with Steamed Broccoli.",
      dinnerCal: "390 kcal (Carbs: 45g, Protein: 22g, Fats: 8g)",
    },
    Friday: {
      breakfast: "Vegetable Poha with Roasted Peanuts & Lemon Juice.",
      breakfastCal: "300 kcal (Carbs: 42g, Protein: 9g, Fats: 7g)",
      lunch: "Brown Rice with Dal Makhani (Low Cream) & Mixed Green Salad.",
      lunchCal: "510 kcal (Carbs: 60g, Protein: 18g, Fats: 10g)",
      dinner: "Paneer Tikka with Grilled Bell Peppers & 1 Wheat Chapati.",
      dinnerCal: "370 kcal (Carbs: 30g, Protein: 22g, Fats: 11g)",
    },
    Saturday: {
      breakfast: "Oatmeal with Walnuts, Chia Seeds & Warm Milk (No Sugar).",
      breakfastCal: "320 kcal (Carbs: 40g, Protein: 12g, Fats: 9g)",
      lunch: "2 Multigrain Rotis with Palak Dal & Boiled Chana Chaat.",
      lunchCal: "480 kcal (Carbs: 54g, Protein: 18g, Fats: 8g)",
      dinner: "Vegetable Khichdi with Roasted Papad & Cucumber Curd.",
      dinnerCal: "360 kcal (Carbs: 48g, Protein: 14g, Fats: 7g)",
    },
    Sunday: {
      breakfast: "Methi Thepla (2 pcs) with Low-Fat Curd & Green Tea.",
      breakfastCal: "310 kcal (Carbs: 38g, Protein: 11g, Fats: 8g)",
      lunch: "Vegetable Quinoa Biryani with Onion-Tomato Raita.",
      lunchCal: "500 kcal (Carbs: 58g, Protein: 17g, Fats: 9g)",
      dinner: "Lauki Kofta (Baked) with 2 Jowar Rotis & Green Salad.",
      dinnerCal: "350 kcal (Carbs: 40g, Protein: 14g, Fats: 7g)",
    },
  };

  const weeklyDietDataNonVegMod = {
    Monday: {
      breakfast: "2 Boiled Eggs with 1 Whole Wheat Toast & Green Tea.",
      breakfastCal: "300 kcal (Carbs: 20g, Protein: 18g, Fats: 10g)",
      lunch: "Grilled Chicken Breast with Brown Rice, Dal & Salad.",
      lunchCal: "520 kcal (Carbs: 48g, Protein: 38g, Fats: 11g)",
      dinner: "Fish Curry with 2 Multigrain Rotis & Steamed Beans.",
      dinnerCal: "400 kcal (Carbs: 32g, Protein: 32g, Fats: 9g)",
    },
    Tuesday: {
      breakfast: "Egg Omelette (1 Whole + 2 Whites) with Spinach & Toast.",
      breakfastCal: "290 kcal (Carbs: 18g, Protein: 22g, Fats: 8g)",
      lunch: "Chicken Biryani (Brown Rice) with Cucumber Mint Raita.",
      lunchCal: "540 kcal (Carbs: 52g, Protein: 36g, Fats: 12g)",
      dinner: "Clear Chicken Soup with 1 Jowar Roti & Grilled Veggies.",
      dinnerCal: "360 kcal (Carbs: 26g, Protein: 30g, Fats: 8g)",
    },
    Wednesday: {
      breakfast: "Scrambled Eggs with Mushrooms & 1 Ragi Dosa.",
      breakfastCal: "310 kcal (Carbs: 26g, Protein: 19g, Fats: 9g)",
      lunch: "Fish Shallow Fry with Moong Dal Khichdi & Salad.",
      lunchCal: "500 kcal (Carbs: 46g, Protein: 34g, Fats: 10g)",
      dinner: "Tandoori Chicken with Mixed Sprout Chaat & Curd.",
      dinnerCal: "380 kcal (Carbs: 22g, Protein: 36g, Fats: 9g)",
    },
    Thursday: {
      breakfast: "Egg Bhurji with 1 Multigrain Paratha & Green Tea.",
      breakfastCal: "320 kcal (Carbs: 24g, Protein: 20g, Fats: 10g)",
      lunch: "Egg Curry with Brown Rice & Sprouted Salad.",
      lunchCal: "490 kcal (Carbs: 44g, Protein: 24g, Fats: 11g)",
      dinner: "Grilled Fish Fillet with Steamed Asparagus & Cauliflower Mash.",
      dinnerCal: "350 kcal (Carbs: 14g, Protein: 35g, Fats: 8g)",
    },
    Friday: {
      breakfast: "Boiled Egg White Salad with Flaxseeds & Whole Wheat Toast.",
      breakfastCal: "280 kcal (Carbs: 22g, Protein: 24g, Fats: 5g)",
      lunch: "Chicken Curry with 2 Jowar Rotis & Cucumber Raita.",
      lunchCal: "510 kcal (Carbs: 42g, Protein: 36g, Fats: 11g)",
      dinner: "Chicken Clear Soup with 1 Multigrain Roti & Subzi.",
      dinnerCal: "350 kcal (Carbs: 24g, Protein: 30g, Fats: 7g)",
    },
    Saturday: {
      breakfast: "Moong Dal Chilla with 1 Boiled Egg & Green Chutney.",
      breakfastCal: "300 kcal (Carbs: 28g, Protein: 19g, Fats: 7g)",
      lunch: "Grilled Fish with Quinoa Pulao & Tomato Salad.",
      lunchCal: "480 kcal (Carbs: 40g, Protein: 36g, Fats: 9g)",
      dinner: "Pan-Seared Chicken Tikka with Steamed Broccoli.",
      dinnerCal: "360 kcal (Carbs: 15g, Protein: 38g, Fats: 9g)",
    },
    Sunday: {
      breakfast: "Egg White Omelette with Oats Toast & Black Coffee.",
      breakfastCal: "290 kcal (Carbs: 20g, Protein: 22g, Fats: 6g)",
      lunch: "Healthy Chicken Curry with Brown Rice & Onion Salad.",
      lunchCal: "530 kcal (Carbs: 48g, Protein: 37g, Fats: 12g)",
      dinner: "Clear Chicken Broth with Boiled Sweet Potato.",
      dinnerCal: "340 kcal (Carbs: 28g, Protein: 28g, Fats: 6g)",
    },
  };

  // 3. Low Risk / Optimal Health Maintenance Meal Schedules (Balanced Energy)
  const weeklyDietDataVegLow = {
    Monday: {
      breakfast: "Vegetable Poha with Roasted Peanuts, Curry Leaves & Tea.",
      breakfastCal: "320 kcal (Carbs: 45g, Protein: 10g, Fats: 8g)",
      lunch: "2 Whole Wheat Chapatis with Dal Tadka, Bhindi Subzi & Curd.",
      lunchCal: "490 kcal (Carbs: 64g, Protein: 16g, Fats: 9g)",
      dinner: "Vegetable Pulao with Cucumber Raita & Roasted Papad.",
      dinnerCal: "390 kcal (Carbs: 55g, Protein: 12g, Fats: 8g)",
    },
    Tuesday: {
      breakfast: "Idli (3 pcs) with Coconut Chutney & Vegetable Sambar.",
      breakfastCal: "310 kcal (Carbs: 48g, Protein: 11g, Fats: 5g)",
      lunch: "Brown Rice with Rajma Curry & Mixed Green Salad.",
      lunchCal: "510 kcal (Carbs: 66g, Protein: 18g, Fats: 9g)",
      dinner: "2 Multigrain Rotis with Palak Paneer & Fresh Salad.",
      dinnerCal: "400 kcal (Carbs: 42g, Protein: 18g, Fats: 11g)",
    },
    Wednesday: {
      breakfast: "Besan Chilla with Mint Chutney & Warm Milk.",
      breakfastCal: "320 kcal (Carbs: 36g, Protein: 15g, Fats: 8g)",
      lunch: "Vegetable Khichdi with Curd, Pickle & Sprouted Salad.",
      lunchCal: "480 kcal (Carbs: 60g, Protein: 15g, Fats: 8g)",
      dinner: "2 Phulkas with Mix Veg Korma & Tomato Soup.",
      dinnerCal: "370 kcal (Carbs: 46g, Protein: 13g, Fats: 8g)",
    },
    Thursday: {
      breakfast: "Oats Upma with Green Peas, Carrots & Almonds.",
      breakfastCal: "300 kcal (Carbs: 40g, Protein: 10g, Fats: 7g)",
      lunch: "2 Chapati with Chole Masala & Boiled Beetroot Salad.",
      lunchCal: "520 kcal (Carbs: 65g, Protein: 18g, Fats: 10g)",
      dinner: "Clear Veg Soup with 1 Multigrain Roti & Paneer Subzi.",
      dinnerCal: "380 kcal (Carbs: 35g, Protein: 18g, Fats: 10g)",
    },
    Friday: {
      breakfast: "Methi Paratha (2 pcs) with Curd & Flaxseed Chutney.",
      breakfastCal: "340 kcal (Carbs: 42g, Protein: 12g, Fats: 10g)",
      lunch: "Brown Rice with Moong Dal & Aloo Gobhi (Low Oil).",
      lunchCal: "490 kcal (Carbs: 62g, Protein: 15g, Fats: 9g)",
      dinner: "2 Jowar Rotis with Baingan Bharta & Curd.",
      dinnerCal: "370 kcal (Carbs: 45g, Protein: 12g, Fats: 8g)",
    },
    Saturday: {
      breakfast: "Masala Dosa (1 pc) with Sambar & Mint Chutney.",
      breakfastCal: "330 kcal (Carbs: 46g, Protein: 9g, Fats: 8g)",
      lunch: "2 Rotis with Paneer Butter Masala (Light) & Salad.",
      lunchCal: "530 kcal (Carbs: 48g, Protein: 20g, Fats: 13g)",
      dinner: "Vegetable Dalia with Roasted Peanuts & Buttermilk.",
      dinnerCal: "360 kcal (Carbs: 48g, Protein: 12g, Fats: 7g)",
    },
    Sunday: {
      breakfast: "Vegetable Rava Upma with Coconut Chutney & Tea.",
      breakfastCal: "310 kcal (Carbs: 44g, Protein: 8g, Fats: 7g)",
      lunch: "Vegetable Biryani with Boondi Raita & Salad.",
      lunchCal: "540 kcal (Carbs: 68g, Protein: 14g, Fats: 11g)",
      dinner: "Clear Lentil Soup with 2 Whole Wheat Phulkas & Sabzi.",
      dinnerCal: "360 kcal (Carbs: 44g, Protein: 14g, Fats: 7g)",
    },
  };

  const weeklyDietDataNonVegLow = {
    Monday: {
      breakfast: "2 Boiled Eggs with 2 Brown Bread Slices & Tea.",
      breakfastCal: "320 kcal (Carbs: 26g, Protein: 18g, Fats: 10g)",
      lunch: "Chicken Curry with 2 Chapatis & Fresh Salad.",
      lunchCal: "530 kcal (Carbs: 45g, Protein: 36g, Fats: 13g)",
      dinner: "Fish Curry with Steamed Rice & Green Beans.",
      dinnerCal: "420 kcal (Carbs: 40g, Protein: 30g, Fats: 9g)",
    },
    Tuesday: {
      breakfast: "Egg Omelette (2 eggs) with Toast & Fresh Juice.",
      breakfastCal: "310 kcal (Carbs: 24g, Protein: 18g, Fats: 11g)",
      lunch: "Chicken Biryani with Raita & Onion Salad.",
      lunchCal: "560 kcal (Carbs: 58g, Protein: 36g, Fats: 14g)",
      dinner: "Clear Chicken Soup with 2 Phulkas & Subzi.",
      dinnerCal: "380 kcal (Carbs: 32g, Protein: 28g, Fats: 8g)",
    },
    Wednesday: {
      breakfast: "Egg Bhurji with 1 Paratha & Green Tea.",
      breakfastCal: "330 kcal (Carbs: 28g, Protein: 18g, Fats: 12g)",
      lunch: "Fish Fry (Olive oil) with Dal & Brown Rice.",
      lunchCal: "510 kcal (Carbs: 48g, Protein: 34g, Fats: 11g)",
      dinner: "Grilled Chicken Tikka with Salad & 1 Roti.",
      dinnerCal: "390 kcal (Carbs: 24g, Protein: 36g, Fats: 9g)",
    },
    Thursday: {
      breakfast: "Scrambled Eggs with Spinach & 2 Toasts.",
      breakfastCal: "320 kcal (Carbs: 26g, Protein: 20g, Fats: 10g)",
      lunch: "Egg Curry (2 eggs) with Rice & Salad.",
      lunchCal: "500 kcal (Carbs: 48g, Protein: 22g, Fats: 12g)",
      dinner: "Chicken Clear Soup with Steamed Veggies.",
      dinnerCal: "340 kcal (Carbs: 16g, Protein: 32g, Fats: 7g)",
    },
    Friday: {
      breakfast: "Boiled Eggs (2 pcs) with Oats Upma.",
      breakfastCal: "310 kcal (Carbs: 30g, Protein: 18g, Fats: 9g)",
      lunch: "Chicken Korma with 2 Multigrain Rotis.",
      lunchCal: "540 kcal (Carbs: 44g, Protein: 35g, Fats: 13g)",
      dinner: "Grilled Fish Fillet with Potato Mash & Beans.",
      dinnerCal: "370 kcal (Carbs: 24g, Protein: 32g, Fats: 8g)",
    },
    Saturday: {
      breakfast: "Egg Dosa (1 pc) with Chutney.",
      breakfastCal: "320 kcal (Carbs: 32g, Protein: 16g, Fats: 10g)",
      lunch: "Chicken Stew with Brown Rice.",
      lunchCal: "520 kcal (Carbs: 46g, Protein: 36g, Fats: 12g)",
      dinner: "Tandoori Chicken with Green Salad.",
      dinnerCal: "360 kcal (Carbs: 14g, Protein: 38g, Fats: 8g)",
    },
    Sunday: {
      breakfast: "Egg Bhurji with 2 Phulkas & Coffee.",
      breakfastCal: "330 kcal (Carbs: 30g, Protein: 19g, Fats: 11g)",
      lunch: "Healthy Chicken Pulao with Mint Raita.",
      lunchCal: "550 kcal (Carbs: 54g, Protein: 35g, Fats: 13g)",
      dinner: "Fish Curry with 1 Chapati & Steamed Broccoli.",
      dinnerCal: "360 kcal (Carbs: 22g, Protein: 30g, Fats: 8g)",
    },
  };

  // Select appropriate plan dataset based on calculated clinical risk tier
  const activePlanDataset = isHighRisk
    ? (dietType === "Vegetarian" ? weeklyDietDataVegHigh : weeklyDietDataNonVegHigh)
    : isModerateRisk
    ? (dietType === "Vegetarian" ? weeklyDietDataVegMod : weeklyDietDataNonVegMod)
    : (dietType === "Vegetarian" ? weeklyDietDataVegLow : weeklyDietDataNonVegLow);

  const currentPlan = activePlanDataset[activeDay] || activePlanDataset["Monday"];

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="diet-page">
          <div className="diet-loading-container">
            <FaSpinner className="diet-spinner" />
            <p>Loading your clinical diet profile...</p>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  // If user has NOT completed an assessment, display prominent call-to-action
  if (!hasAssessment || !patientStatus) {
    return (
      <>
        <Navbar />
        <div className="diet-page">
          <div className="diet-container">
            <BackButton />

            <div className="diet-empty-state-card text-center">
              <div className="diet-empty-icon-wrap">
                <FaClipboardList />
              </div>
              <h1>No Clinical Assessment Found</h1>
              <p className="diet-empty-desc">
                Your personalized metabolic nutrition schedule is customized specifically to your <strong>Blood Glucose, BMI, Blood Pressure</strong>, and <strong>AI Risk Classification</strong>.
              </p>
              <p className="diet-empty-subtext">
                Please complete your 2-minute AI Health Assessment first so our engine can formulate an accurate, evidence-based meal regimen tailored to your metabolic status.
              </p>

              <Link to="/assessment" className="start-assessment-cta-btn">
                <span>Start AI Risk Assessment</span>
                <FaArrowRight />
              </Link>

              <div className="diet-preview-features-grid">
                <div className="preview-pill-card">
                  <FaCheckCircle className="pill-check" />
                  <div>
                    <h4>Glycemic Index Matching</h4>
                    <p>Strict low-GI carbohydrates tailored to your insulin sensitivity</p>
                  </div>
                </div>
                <div className="preview-pill-card">
                  <FaCheckCircle className="pill-check" />
                  <div>
                    <h4>Calorie & Macro Targets</h4>
                    <p>Precise protein, carb, and fat distributions for all 7 days</p>
                  </div>
                </div>
                <div className="preview-pill-card">
                  <FaCheckCircle className="pill-check" />
                  <div>
                    <h4>Daily Habit Streaks</h4>
                    <p>Track hydration, fiber intake, steps, and glucose logs</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />

      <div className="diet-page">
        <div className="diet-container">
          <BackButton />

          {/* Page Header */}
          <div className="diet-header text-center">
            <div className="header-top-badges">
              <span className="badge-pill"><FaUtensils /> AI Medical Diet Planner</span>
              <span className="fire-streak-badge"><FaFire /> 🔥 {streakCount} Day Health Streak</span>
            </div>

            <h1>Personalized Low-GI Indian Nutrition Plan</h1>
            <p>Assessment-driven daily meal schedules featuring traditional Indian food options to optimize blood glucose stability.</p>

            {/* Assessment-Driven Status Banner */}
            <div className={`diet-patient-status-banner ${isHighRisk ? "high-risk" : isModerateRisk ? "mod-risk" : "low-risk"}`}>
              <div className="status-banner-left">
                {isHighRisk ? <FaExclamationTriangle /> : isModerateRisk ? <FaBrain /> : <FaCheckCircle />}
                <div>
                  <h3>
                    Assessment Profile: {patientStatus.prediction} ({patientStatus.risk_percentage}% Risk Score)
                  </h3>
                  <p>
                    {isHighRisk
                      ? "Strict Low-GI Glycemic Control Plan (<45 GI) designed for insulin resistance management."
                      : isModerateRisk
                      ? "Preventive Glycemic Stability Plan (<55 GI) designed for prediabetes glucose control."
                      : "Optimal Metabolic Health Maintenance Plan designed for sustained cellular energy."}
                  </p>
                </div>
              </div>
              <div className="status-badge">
                Glucose: {patientStatus.glucose} mg/dL | BMI: {patientStatus.bmi}
              </div>
            </div>
          </div>

          {/* Daily Health Goals Widget */}
          <div className="daily-goals-card">
            <div className="goals-header">
              <div>
                <h2><FaBullseye /> Daily Metabolic Health Goals</h2>
                <p>Track your daily lifestyle targets tailored to your assessment risk score.</p>
              </div>
              <div className="goal-progress-badge">
                {completedGoalsCount} of 4 Completed ({goalProgressPercentage}%)
              </div>
            </div>

            <div className="goals-progress-bar">
              <div
                className="goals-progress-fill"
                style={{
                  width: `${goalProgressPercentage}%`,
                  background: isAllGoalsCompleted ? "linear-gradient(90deg, #10b981 0%, #059669 100%)" : "linear-gradient(90deg, #0ea5e9 0%, #10b981 100%)"
                }}
              />
            </div>

            {/* 1. Already Claimed For Today -> Show 'Completed Daily Tasks' Banner */}
            {streakClaimed ? (
              <div className="goals-complete-congratulations claimed-today">
                <div className="congratulations-left">
                  <FaCheckCircle className="trophy-icon claimed-icon" />
                  <div>
                    <h3>✅ You Have Completed Today's Daily Tasks!</h3>
                    <p>Great job! You achieved all 4 metabolic health goals today and saved your streak. Come back tomorrow for your next day targets!</p>
                  </div>
                </div>
                <div className="streak-locked-pill">
                  <FaFire /> 🔥 Today's Streak Claimed ({streakCount} Days)
                </div>
              </div>
            ) : isAllGoalsCompleted ? (
              /* 2. All 4 Goals Just Checked -> Show 'Claim Streak' Button (1 time only) */
              <div className="goals-complete-congratulations">
                <div className="congratulations-left">
                  <FaTrophy className="trophy-icon" />
                  <div>
                    <h3>🎉 All Daily Health Goals Completed Today!</h3>
                    <p>Your insulin sensitivity & metabolic markers are optimized for today. Save your streak for today!</p>
                  </div>
                </div>
                <button className="claim-streak-btn" onClick={handleClaimStreakAndNextDay}>
                  <FaFire /> 🔥 Claim Today's Streak ({streakCount + 1} Days) <FaArrowRight />
                </button>
              </div>
            ) : null}

            <div className="goals-grid">
              <div
                className={`goal-item-card ${dailyGoals.water ? "completed" : ""} ${streakClaimed ? "locked" : ""}`}
                onClick={() => toggleGoal("water")}
              >
                <div className="goal-icon cyan"><FaTint /></div>
                <div className="goal-info">
                  <h4>{isHighRisk ? "3.5 Liters Water Goal" : isModerateRisk ? "3.0 Liters Water Goal" : "2.5 Liters Water Goal"}</h4>
                  <p>Flushes excess blood glucose via renal excretion</p>
                </div>
                <div className="checkbox">{dailyGoals.water ? "✓" : ""}</div>
              </div>

              <div
                className={`goal-item-card ${dailyGoals.steps ? "completed" : ""} ${streakClaimed ? "locked" : ""}`}
                onClick={() => toggleGoal("steps")}
              >
                <div className="goal-icon emerald"><FaWalking /></div>
                <div className="goal-info">
                  <h4>{isHighRisk ? "10,000 Daily Steps Goal" : isModerateRisk ? "8,000 Daily Steps Goal" : "7,500 Daily Steps Goal"}</h4>
                  <p>Stimulates GLUT4 glucose uptake in skeletal muscle</p>
                </div>
                <div className="checkbox">{dailyGoals.steps ? "✓" : ""}</div>
              </div>

              <div
                className={`goal-item-card ${dailyGoals.fiber ? "completed" : ""} ${streakClaimed ? "locked" : ""}`}
                onClick={() => toggleGoal("fiber")}
              >
                <div className="goal-icon amber"><FaAppleAlt /></div>
                <div className="goal-info">
                  <h4>{isHighRisk ? "35g Soluble Fiber Target" : isModerateRisk ? "30g Soluble Fiber Target" : "25g Soluble Fiber Target"}</h4>
                  <p>Slows carb digestion (Oats, Ragi, Sprouts)</p>
                </div>
                <div className="checkbox">{dailyGoals.fiber ? "✓" : ""}</div>
              </div>

              <div
                className={`goal-item-card ${dailyGoals.glucose ? "completed" : ""} ${streakClaimed ? "locked" : ""}`}
                onClick={() => toggleGoal("glucose")}
              >
                <div className="goal-icon indigo"><FaHeartbeat /></div>
                <div className="goal-info">
                  <h4>{isHighRisk ? "Blood Glucose Logged (2x/day)" : isModerateRisk ? "Fasting Glucose Logged" : "Weekly Glucose Logged"}</h4>
                  <p>Track morning & post-meal blood sugar levels</p>
                </div>
                <div className="checkbox">{dailyGoals.glucose ? "✓" : ""}</div>
              </div>
            </div>
          </div>

          {/* Controls: Diet Type & Day Selector */}
          <div className="diet-controls">
            <div className="diet-type-toggle">
              <button
                className={`type-btn ${dietType === "Vegetarian" ? "active" : ""}`}
                onClick={() => setDietType("Vegetarian")}
              >
                <FaLeaf /> Indian Vegetarian
              </button>
              <button
                className={`type-btn ${dietType === "Non-Vegetarian" ? "active" : ""}`}
                onClick={() => setDietType("Non-Vegetarian")}
              >
                <FaDrumstickBite /> Indian Non-Vegetarian / High Protein
              </button>
            </div>

            <div className="days-tabs">
              {days.map((day) => (
                <button
                  key={day}
                  className={`day-tab ${activeDay === day ? "active" : ""}`}
                  onClick={() => setActiveDay(day)}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          {/* Active Day Meal Cards */}
          <div className="meals-container">
            <h2 className="day-title">{activeDay}'s Clinical Meal Schedule ({dietType})</h2>

            <div className="meals-grid">
              <div className="meal-card">
                <div className="meal-header">
                  <span className="meal-time-icon">🌅</span>
                  <h3>Morning Breakfast</h3>
                </div>
                <p className="meal-text">{currentPlan.breakfast}</p>
                <span className="meal-cal-badge">{currentPlan.breakfastCal}</span>
              </div>

              <div className="meal-card">
                <div className="meal-header">
                  <span className="meal-time-icon">☀️</span>
                  <h3>Afternoon Lunch</h3>
                </div>
                <p className="meal-text">{currentPlan.lunch}</p>
                <span className="meal-cal-badge">{currentPlan.lunchCal}</span>
              </div>

              <div className="meal-card">
                <div className="meal-header">
                  <span className="meal-time-icon">🌙</span>
                  <h3>Evening Dinner</h3>
                </div>
                <p className="meal-text">{currentPlan.dinner}</p>
                <span className="meal-cal-badge">{currentPlan.dinnerCal}</span>
              </div>
            </div>
          </div>

          {/* Exercise & Clinical Guidelines Section */}
          <div className="diet-extra-grid">
            <div className="extra-card">
              <h2><FaRunning /> Exercise & Activity Prescription</h2>
              <ul>
                <li><FaCheckCircle /> 30-45 minutes brisk walking daily post-meals.</li>
                <li><FaCheckCircle /> 15-20 mins Surya Namaskar & Pranayama for stress reduction.</li>
                <li><FaCheckCircle /> Moderate resistance training 3 days a week.</li>
              </ul>
            </div>

            <div className="extra-card highlight">
              <h2>💙 Low-GI Indian Nutrition Principles</h2>
              <ul>
                <li><FaCheckCircle /> Replace white rice with Brown Rice, Ragi, Jowar, or Bajra.</li>
                <li><FaCheckCircle /> Include protein in every meal (Dal, Paneer, Sprouted Moong/Chana, Eggs, Chicken).</li>
                <li><FaCheckCircle /> Eliminate sugary drinks, sweet chai, and refined Maida products.</li>
                <li><FaCheckCircle /> Stay hydrated with at least 3 liters of water daily.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </>
  );
}

export default DietPlan;