# Analytic IK Paper Notes

## Source

- PDF: `/home/r/projects/course_paper_4-9.pdf`
- Relevant pages: `13-16`

## Extracted Position IK

For the manipulator, the inverse kinematics is decomposed into:

1. position solution for `q1, q2, q3`
2. orientation solution for `q4, q5, q6`

Position block from the paper:

```text
p4^0 = p6^0 - d6 * R6^0 * [0, 0, 1]^T

theta1 = atan(y4^0 / x4^0)
theta2 = pi/2 - mu - lambda
theta3 = pi + theta2 - alpha - gamma

c = sqrt((x4^0)^2 + (y4^0)^2)
b = z4^0 - d1
alpha = atan(d4 / a3)
gamma = acos((a2^2 + a3^2 + d4^2 - c^2 - b^2) / (2 * a2 * sqrt(a3^2 + d4^2)))
mu = atan(b / c)
a = sqrt(c^2 + b^2)
lambda = acos((a2^2 + a^2 - a3^2 - d4^2) / (2 * a2 * a))
```

## Extracted Orientation IK

```text
theta4 = q4 = asin(r23 / r33)
theta5 = q5 = acos(r33)
theta6 = q6 = atan(-r32 / r31)
```

## DH Table From The Paper

```text
i   ai   alpha_i   di   theta_i
1   a1   pi/2      d1   theta1
2   a2   0         0    theta2 + pi/2
3   a3   pi/2      0    theta3
4   0   -pi/2      d4   theta4
5   0    pi/2      0    theta5
6   0    0         d6   theta6
```

## Current URDF Mapping Used For GUI Preview

These values are inferred from the current URDF chain and are used only as the
GUI-side preview geometry for the paper formulas:

```text
d1 = 0.169525 m
a2 = 0.305001 m
a3 = 0.00675 m
d4 = 0.22225 m
d6 = 0.08537 m
```

The mapping lives in:

- [armGeometry.ts](/home/r/silver_ws/src/silverhand_arm_teleop/ui/src/kinematics/armGeometry.ts)

## Joint Convention Mapping

The paper and the current URDF do not share the same zero configuration.

So the preview stack explicitly uses two joint conventions:

1. `paper joints`
   Angles in the convention of the course paper formulas.
2. `URDF joints`
   Angles used by the GUI model and the current robot description.

The conversion layer lives in:

- `paperToUrdfJointsDeg(...)`
- `urdfToPaperJointsDeg(...)`

Current preview calibration offsets:

```text
[+16.2562, +42.4178, -24.0791, -38.6058, -3.4525, +152.7748] deg
```

This is a GUI-side mapping layer, not a claim that the paper convention is
"wrong". It only means that the paper zero pose and the URDF zero pose are not
the same configuration.

## Important Caveat

This is still a paper-to-URDF mapping layer. Before treating it as final, it
should be verified against:

1. the actual TCP frame used by the robot
2. the branch selection rules
3. the real execution-side solver or known-good poses
