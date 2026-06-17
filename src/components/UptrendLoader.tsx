import React, { useEffect } from 'react'
import { View } from 'react-native'
import Svg, { Rect } from 'react-native-svg'
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  interpolate,
  Extrapolate,
  runOnJS,
  Easing,
  SharedValue,
} from 'react-native-reanimated'

const AnimatedRect = Animated.createAnimatedComponent(Rect)

// Bar tops, rising left-to-right like an uptrend on a forex bar chart. No arrow/line —
// the rising bars alone are the "uptrend" per feedback that the line-and-arrowhead
// version looked wrong.
const BARS = [
  { x: 20,  topY: 155 },
  { x: 80,  topY: 120 },
  { x: 140, topY: 90  },
  { x: 200, topY: 60  },
  { x: 260, topY: 35  },
]

const BASELINE = 170
const BAR_WIDTH = 30

interface BarProps {
  t: SharedValue<number>
  x: number
  topY: number
  color: string
  delayFrac: number
  durFrac: number
}

function Bar({ t, x, topY, color, delayFrac, durFrac }: BarProps) {
  const animatedProps = useAnimatedProps(() => {
    const grow = interpolate(
      t.value,
      [delayFrac, delayFrac + durFrac],
      [0, 1],
      Extrapolate.CLAMP
    )
    const height = grow * (BASELINE - topY)
    return {
      y: BASELINE - height,
      height,
    } as any
  })
  return (
    <AnimatedRect
      x={x - BAR_WIDTH / 2}
      width={BAR_WIDTH}
      rx={4}
      fill={color}
      animatedProps={animatedProps}
    />
  )
}

interface Props {
  color?: string
  barColor?: string
  size?: number
  loop?: boolean
  onComplete?: () => void
}

export default function UptrendLoader({
  color = '#3B82F6',
  barColor,
  size = 160,
  loop = true,
  onComplete,
}: Props) {
  const resolvedColor = barColor || color
  const t = useSharedValue(0)

  useEffect(() => {
    if (loop) {
      t.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1400, easing: Easing.out(Easing.cubic) }),
          withDelay(600, withTiming(0, { duration: 250, easing: Easing.in(Easing.cubic) }))
        ),
        -1
      )
    } else {
      t.value = withTiming(1, { duration: 1400, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (finished && onComplete) runOnJS(onComplete)()
      })
    }
  }, [])

  const height = size * (170 / 300)

  return (
    <View style={{ width: size, height }}>
      <Svg width={size} height={height} viewBox="0 0 300 170">
        {BARS.map((b, i) => (
          <Bar
            key={i}
            t={t}
            x={b.x}
            topY={b.topY}
            color={resolvedColor}
            delayFrac={i * 0.15}
            durFrac={0.35}
          />
        ))}
      </Svg>
    </View>
  )
}
