import React, { useEffect, useState, useRef } from 'react';

const BackgroundCat = () => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [currentActivity, setCurrentActivity] = useState(null);
  const [targetPosition, setTargetPosition] = useState({ x: 0, y: 0 });
  const activityTimerRef = useRef(null);
  const animationFrameRef = useRef(null);
  const velocityRef = useRef({ x: 0, y: 0 });

  // Cat activities with their durations (in milliseconds)
  const activities = [
    { name: 'sit', duration: 3000, emoji: '🧶', face: '🐱' },
    { name: 'walk', duration: 4000, emoji: '🐾', face: '🐱' },
    { name: 'sleep', duration: 5000, emoji: '💤', face: '😴' },
    { name: 'play', duration: 2000, emoji: '🎾', face: '😸' },
    { name: 'stretch', duration: 2500, emoji: '🤸', face: '😺' },
    { name: 'groom', duration: 3500, emoji: '👅', face: '😌' },
    { name: 'hunt', duration: 3000, emoji: '👀', face: '😼' },
    { name: 'curious', duration: 2000, emoji: '❓', face: '🤔' }
  ];

  // Initialize position on mount
  useEffect(() => {
    const initPosition = {
      x: Math.random() * (window.innerWidth - 100),
      y: Math.random() * (window.innerHeight - 100)
    };
    setPosition(initPosition);
    setTargetPosition(initPosition);
  }, []);

  // Animation loop
  useEffect(() => {
    const animate = () => {
      setPosition(prevPos => {
        const dx = targetPosition.x - prevPos.x;
        const dy = targetPosition.y - prevPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 2) {
          return {
            x: prevPos.x + velocityRef.current.x,
            y: prevPos.y + velocityRef.current.y
          };
        }
        return prevPos;
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [targetPosition]);

  // Random behavior system
  useEffect(() => {
    const performActivity = () => {
      const activity = activities[Math.floor(Math.random() * activities.length)];
      setCurrentActivity(activity);

      // If walking, set new target position
      if (activity.name === 'walk') {
        const newTarget = {
          x: Math.random() * (window.innerWidth - 100),
          y: Math.random() * (window.innerHeight - 100)
        };
        setTargetPosition(newTarget);

        // Calculate velocity for smooth movement
        setPosition(prevPos => {
          const dx = newTarget.x - prevPos.x;
          const dy = newTarget.y - prevPos.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance > 0) {
            velocityRef.current = {
              x: (dx / distance) * 0.8,
              y: (dy / distance) * 0.8
            };
          }
          return prevPos;
        });
      }

      // Set timer for next activity
      activityTimerRef.current = setTimeout(() => {
        performActivity();
      }, activity.duration + Math.random() * 2000);
    };

    performActivity();

    return () => {
      if (activityTimerRef.current) {
        clearTimeout(activityTimerRef.current);
      }
    };
  }, []);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setPosition(prevPos => ({
        x: Math.min(prevPos.x, window.innerWidth - 100),
        y: Math.min(prevPos.y, window.innerHeight - 100)
      }));
      setTargetPosition(prevTarget => ({
        x: Math.min(prevTarget.x, window.innerWidth - 100),
        y: Math.min(prevTarget.y, window.innerHeight - 100)
      }));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Activity-based animations
  const getActivityAnimation = () => {
    if (!currentActivity) return {};

    const baseAnimation = {
      animationIterationCount: 'infinite',
      animationTimingFunction: 'ease-in-out'
    };

    switch (currentActivity.name) {
      case 'walk':
        return {
          ...baseAnimation,
          animation: 'catWalk 0.5s ease-in-out infinite'
        };
      case 'sleep':
        return {
          ...baseAnimation,
          animation: 'catSleep 2s ease-in-out infinite'
        };
      case 'play':
        return {
          ...baseAnimation,
          animation: 'catPlay 0.3s ease-in-out infinite'
        };
      case 'stretch':
        return {
          ...baseAnimation,
          animation: 'catStretch 1s ease-in-out infinite'
        };
      case 'hunt':
        return {
          ...baseAnimation,
          animation: 'catHunt 0.4s ease-in-out infinite'
        };
      default:
        return {};
    }
  };

  const catStyles = {
    position: 'fixed',
    left: position.x,
    top: position.y,
    width: '60px',
    height: '60px',
    pointerEvents: 'none',
    zIndex: -1,
    transition: 'transform 0.3s ease',
    userSelect: 'none',
    ...getActivityAnimation()
  };

  const catBodyStyles = {
    position: 'relative',
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center'
  };

  const catFaceStyles = {
    fontSize: '40px',
    animation: 'catBreathe 2s ease-in-out infinite'
  };

  const activityIconStyles = {
    position: 'absolute',
    top: '-10px',
    right: '-10px',
    fontSize: '16px',
    animation: 'activityPulse 1s ease-in-out infinite'
  };

  return (
    <>
      <style jsx>{`
        @keyframes catBreathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }

        @keyframes activityPulse {
          0%, 100% { opacity: 0.7; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.2); }
        }

        @keyframes catWalk {
          0%, 100% { transform: translateY(0px); }
          25% { transform: translateY(-2px); }
          75% { transform: translateY(2px); }
        }

        @keyframes catSleep {
          0%, 100% { opacity: 0.8; }
          50% { opacity: 0.4; }
        }

        @keyframes catPlay {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-5deg); }
          75% { transform: rotate(5deg); }
        }

        @keyframes catStretch {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(1.3); }
        }

        @keyframes catHunt {
          0%, 100% { transform: scale(1); }
          25% { transform: scale(0.95) translateX(-2px); }
          75% { transform: scale(1.05) translateX(2px); }
        }
      `}</style>
      
      <div style={catStyles}>
        <div style={catBodyStyles}>
          <div style={catFaceStyles}>
            {currentActivity ? currentActivity.face : '🐱'}
          </div>
          <div style={activityIconStyles}>
            {currentActivity ? currentActivity.emoji : ''}
          </div>
        </div>
      </div>
    </>
  );
};

export default BackgroundCat;