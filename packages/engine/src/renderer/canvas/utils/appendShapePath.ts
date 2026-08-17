import type { ShapePathCommand } from "../../../nodes";

type CanvasPathContext = Pick<
	CanvasRenderingContext2D,
	| "arc"
	| "closePath"
	| "lineTo"
	| "moveTo"
	| "quadraticCurveTo"
	| "restore"
	| "save"
	| "scale"
	| "translate"
>;

export function appendShapePath(
	context: CanvasPathContext,
	commands: readonly ShapePathCommand[],
): void {
	for (const command of commands) {
		switch (command.type) {
			case "moveTo":
				context.moveTo(command.point.x, command.point.y);
				break;

			case "lineTo":
				context.lineTo(command.point.x, command.point.y);
				break;

			case "quadraticCurveTo":
				context.quadraticCurveTo(
					command.control.x,
					command.control.y,
					command.point.x,
					command.point.y,
				);
				break;

			case "arcTo":
				if (command.radiusX <= 0 || command.radiusY <= 0) {
					break;
				}

				context.save();
				context.translate(command.center.x, command.center.y);
				context.scale(command.radiusX, command.radiusY);
				context.arc(
					0,
					0,
					1,
					(command.startAngle * Math.PI) / 180,
					(command.endAngle * Math.PI) / 180,
					!command.clockwise,
				);
				context.restore();
				break;

			case "closePath":
				context.closePath();
				break;
		}
	}
}