import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import HomeScreen     from './src/screens/HomeScreen';
import ExerciseScreen from './src/screens/ExerciseScreen';
import HistoryScreen  from './src/screens/HistoryScreen';
import { registerBackgroundTask, setupNotifications } from './src/services/background';

const Tab = createBottomTabNavigator();

export default function App() {
  useEffect(() => {
    (async () => {
      await setupNotifications();
      await registerBackgroundTask();
    })();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light"/>
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            tabBarIcon: ({ focused }) => {
              const icons = {
                '即時': '⚖️',
                '訓練': '🏋️',
                '記錄': '📊',
              };
              return <Text style={{ fontSize: focused ? 22 : 18 }}>{icons[route.name]}</Text>;
            },
            tabBarActiveTintColor:   '#667eea',
            tabBarInactiveTintColor: '#9898b8',
            tabBarStyle: {
              backgroundColor: '#fff',
              borderTopColor: '#e4e6f0',
              paddingBottom: Platform.OS === 'ios' ? 20 : 8,
              height: Platform.OS === 'ios' ? 84 : 60,
            },
            tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
            headerStyle: {
              backgroundColor: '#667eea',
              elevation: 0, shadowOpacity: 0,
            },
            headerTintColor: '#fff',
            headerTitleStyle: { fontWeight: '700', fontSize: 17 },
          })}
        >
          <Tab.Screen
            name="即時"
            component={HomeScreen}
            options={{ title: '步態平衡追蹤' }}
          />
          <Tab.Screen
            name="訓練"
            component={ExerciseScreen}
            options={{ title: '平衡訓練' }}
          />
          <Tab.Screen
            name="記錄"
            component={HistoryScreen}
            options={{ title: '測量記錄' }}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
