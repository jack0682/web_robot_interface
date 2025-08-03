/**
 * MQTT 연결 훅
 */
export const useMqttConnection = () => ({
  isConnected: false,
  connectionStatus: 'disconnected' as const,
  status: 'disconnected' as const
});