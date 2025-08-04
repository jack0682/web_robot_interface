#!/usr/bin/env python3
"""
🔧 수정된 스케일 센서 MQTT 퍼블리셰 - 로봇과 호환
- 기존 7개 필터 토픽 + 로봇 호환용 'test' 토픽 추가 발행
- 시작/농도조절 버튼 명령 수신 기능 추가
"""

import rclpy
from rclpy.node import Node
from std_msgs.msg import Float32
import serial
import paho.mqtt.client as mqtt
import json
from datetime import datetime
import numpy as np
from collections import deque
import csv
import os
from typing import Dict, Deque, List, Optional

# ─── 기본 설정 ────────────────────────────────────────────
MQTT_BROKER_HOST = 'p021f2cb.ala.asia-southeast1.emqxsl.com'
MQTT_BROKER_PORT = 8883
MQTT_USERNAME = 'Rokey'
MQTT_PASSWORD = '1234567'

# 🔥 기존 토픽들
MQTT_TOPIC_RAW = 'scale/raw'
MQTT_TOPIC_MA = 'scale/moving_average'
MQTT_TOPIC_EMA = 'scale/exponential_average'
MQTT_TOPIC_KALMAN_SIMPLE = 'scale/kalman_simple'
MQTT_TOPIC_KALMAN_PV = 'scale/kalman_pv'
MQTT_TOPIC_EKF = 'scale/ekf'
MQTT_TOPIC_UKF = 'scale/ukf'

# 🔥 로봇 호환용 추가 토픽들
MQTT_TOPIC_ROBOT_WEIGHT = 'test'  # 로봇이 구독하는 토픽과 일치
MQTT_TOPIC_ROBOT_START = 'robot/command/start'
MQTT_TOPIC_ROBOT_SUGAR = 'robot/command/sugar'

MQTT_KEEPALIVE = 60
SERIAL_PORT = '/dev/ttyACM0'
SERIAL_BAUDRATE = 38400
PUBLISH_INTERVAL = 0.1

# 필터 파라미터
MOVING_AVERAGE_WINDOW = 10
EMA_ALPHA = 0.2
KALMAN_PROCESS_NOISE = 1.0
KALMAN_MEASUREMENT_NOISE = 10.0

# 로깅 설정
ENABLE_DATA_LOGGING = True
LOG_FILE_PREFIX = 'filter_data'
LOG_DIRECTORY = os.path.expanduser('~/Documents')
ANALYSIS_WINDOW = 100

# 물 따르기 평가 설정
ENABLE_POURING_ANALYSIS = True
POURING_THRESHOLD = 0.5  # g/s
STABILITY_WINDOW = 20
TARGET_TOLERANCE = 1.0
WEIGHT_ACCURACY = 0.3
WEIGHT_STABILITY = 0.3
WEIGHT_RESPONSIVENESS = 0.2
WEIGHT_OVERSHOOT = 0.2
# ─────────────────────────────────────────────────────────────

class SimpleKalmanFilter:
    def __init__(self, process_noise: float = 1.0, measurement_noise: float = 10.0):
        self.process_noise = process_noise
        self.measurement_noise = measurement_noise
        self.estimate = 0.0
        self.error_estimate = 1.0
        self.initialized = False
    
    def update(self, measurement: float) -> float:
        if not self.initialized:
            self.estimate = measurement
            self.initialized = True
            return self.estimate
        
        predicted_estimate = self.estimate
        predicted_error = self.error_estimate + self.process_noise
        
        kalman_gain = predicted_error / (predicted_error + self.measurement_noise)
        self.estimate = predicted_estimate + kalman_gain * (measurement - predicted_estimate)
        self.error_estimate = (1 - kalman_gain) * predicted_error
        
        return self.estimate

class PositionVelocityKalmanFilter:
    def __init__(self, dt: float = 0.1, process_noise: float = 1.0, measurement_noise: float = 10.0):
        self.dt = dt
        self.x = np.array([0.0, 0.0])
        self.F = np.array([[1, self.dt], [0, 1]])
        self.H = np.array([[1, 0]])
        self.Q = np.array([[process_noise * (self.dt**4)/4, process_noise * (self.dt**3)/2],
                          [process_noise * (self.dt**3)/2, process_noise * self.dt**2]])
        self.R = np.array([[measurement_noise]])