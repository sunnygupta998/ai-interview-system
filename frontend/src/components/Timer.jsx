import React, { useState, useEffect } from 'react';
import { FiClock } from 'react-icons/fi';
import './Timer.css';

const Timer = ({ totalSeconds, onTimeUp }) => {
  const [timeLeft, setTimeLeft] = useState(totalSeconds);

  useEffect(() => {
    if (timeLeft <= 0) {
      if (onTimeUp) onTimeUp();
      return;
    }

    const intervalId = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(intervalId);
  }, [timeLeft, onTimeUp]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  
  // Calculate percentage of time remaining
  const percentage = (timeLeft / totalSeconds) * 100;
  
  let timerClass = 'timer-green';
  if (percentage <= 25) {
    timerClass = 'timer-red timer-pulse';
  } else if (percentage <= 50) {
    timerClass = 'timer-yellow';
  }

  return (
    <div className={`test-timer glass-card ${timerClass}`}>
      <FiClock className="timer-icon" />
      <span className="timer-text">{formattedTime}</span>
    </div>
  );
};

export default Timer;
