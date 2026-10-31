"""
Pydantic v2 schemas: Simulation Snapshot for 60 FPS WebSocket (UC-12)
"""
from typing import List, Optional
from pydantic import BaseModel


class ParcelSnapshot(BaseModel):
    id: str
    track_id: int
    x: float
    y: float
    status: str
    destination: str
    color: str
    confidence: float


class GateSnapshot(BaseModel):
    gate_number: int
    status: str
    arm_angle: float
    is_active: bool
    total_sorted: int


class SimulationStateSnapshot(BaseModel):
    timestamp_ms: float
    fps: float
    total_sorted: int
    active_parcels_count: int
    parcels: List[ParcelSnapshot]
    gates: List[GateSnapshot]
    amr_x: float
    amr_y: float
    throughput_rate_per_hour: int
