import "./DietPlan.css";
import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import Navbar from "../../components/Navbar/Navbar";
import BackButton from "../../components/BackButton/BackButton";
import Footer from "../../components/Footer/Footer";
import { FaUtensils, FaCheckCircle, FaRunning, FaLeaf, FaDrumstickBite, FaBullseye, FaTint, FaWalking, FaAppleAlt, FaHeartbeat, FaBrain, FaExclamationTriangle, FaFire, FaTrophy, FaArrowRight, FaLock } from "react-icons/fa";
import { dietService, predictionService } from "../../services/api";

function DietPlan() {
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const [activeDay, setActiveDay] = useState("Monday");
  const [dietType, setDietType] = useState("Vegetarian");
  const [patientStatus, setPatientStatus] = useState({
    prediction: "Non-Diabetic",
    risk_percentage: 5.5,
    glucose: 115,
    bmi: 24.2,
  });

  const todayKey = new Date().toISOString().split("T")[0];

  // Persistent Streak Counter State
  const [streakCount, setStreakCount] = useState(() => {
    const savedStreak = localStorage.getItem("diasense_health_streak");
    return savedStreak ? parseInt(savedStreak, 10) : 1;
  });

  // Has streak/tasks already been completed and claimed today?
  const [streakClaimed, setStreakClaimed] = useState(() => {
    return localStorage.getItem(`diasense_streak_claimed_${todayKey}`) === "true";
  });

  // Persistent Goal State for Today
  const [dailyGoals, setDailyGoals] = useState(() => {
    const isClaimedToday = localStorage.getItem(`diasense_streak_claimed_${todayKey}`) === "true";
    if (isClaimedToday) {
      return { water: true, steps: true, fiber: true, glucose: true };
    }
    const saved = localStorage.getItem(`diasense_goals_${todayKey}`);
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
      localStorage.setItem(`diasense_goals_${todayKey}`, JSON.stringify(dailyGoals));
    }
  }, [dailyGoals, todayKey, streakClaimed]);

  useEffect(() => {
    // 1. Read stored prediction from localStorage
    const stored = localStorage.getItem("latest_prediction");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.prediction) {
          setPatientStatus({
            prediction: parsed.prediction,
            risk_percentage: parsed.risk_percentage || 5.5,
            glucose: parsed.glucose || 115,
            bmi: parsed.bmi || 24.2,
          });
        }
      } catch (e) {}
    }

    // 2. Fetch latest prediction from API
    predictionService
      .getLatest()
      .then((res) => {
        if (res.data) {
          setPatientStatus({
            prediction: res.data.prediction,
            risk_percentage: res.data.risk_percentage,
            glucose: res.data.glucose || 115,
            bmi: res.data.bmi || 24.2,
          });
        }
      })
      .catch(() => {});
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
    localStorage.setItem("diasense_health_streak", newStreak.toString());
    
    setStreakClaimed(true);
    localStorage.setItem(`diasense_streak_claimed_${todayKey}`, "true");

    // Lock all goals as completed for today
    const completedAll = { water: true, steps: true, fiber: true, glucose: true };
    setDailyGoals(completedAll);
    localStorage.setItem(`diasense_goals_${todayKey}`, JSON.stringify(completedAll));

    toast.success(`🔥 Streak Upgraded to ${newStreak} Days! You have completed today's daily tasks! 🎉`);
  };

  const isHighRisk = patientStatus.prediction === "Diabetic" || patientStatus.risk_percentage >= 50.0;
  const isModerateRisk = !isHighRisk && patientStatus.risk_percentage >= 25.0;

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

  const currentPlan = (dietType === "Vegetarian" ? weeklyDietDataVegHigh : weeklyDietDataNonVegHigh)[activeDay];

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
                {isHighRisk ? <FaExclamationTriangle /> : <FaBrain />}
                <div>
                  <h3>
                    Assessment Profile: {patientStatus.prediction} ({patientStatus.risk_percentage}% Risk Score)
                  </h3>
                  <p>
                    {isHighRisk
                      ? "Strict Low-GI Glycemic Control Plan (<45 GI) designed for insulin resistance management."
                      : isModerateRisk
                      ? "Preventive Glycemic Stability Plan designed for prediabetes glucose control."
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
                  <h4>{isHighRisk ? "3.5 Liters Water Goal" : "3.0 Liters Water Goal"}</h4>
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
                  <h4>{isHighRisk ? "10,000 Daily Steps Goal" : "8,000 Daily Steps Goal"}</h4>
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
                  <h4>{isHighRisk ? "35g Soluble Fiber Target" : "30g Soluble Fiber Target"}</h4>
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
                  <h4>{isHighRisk ? "Blood Glucose Logged (2x/day)" : "Fasting Glucose Logged"}</h4>
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