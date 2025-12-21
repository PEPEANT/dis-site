class SpatialGrid {
    constructor(width, height, cellSize) {
        this.cellSize = cellSize;
        this.cols = Math.ceil(width / cellSize);
        this.rows = Math.ceil(height / cellSize);
        this.buckets = new Map();
    }

    clear() {
        this.buckets.clear();
    }

    getKey(x, y) {
        // 좌표를 격자 인덱스로 변환
        const col = Math.floor(x / this.cellSize);
        const row = Math.floor(y / this.cellSize);
        return `${col},${row}`;
    }

    insert(entity) {
        if (entity.dead) return;

        // 유닛의 중심 좌표 기준
        const key = this.getKey(entity.x, entity.y);

        if (!this.buckets.has(key)) {
            this.buckets.set(key, []);
        }
        this.buckets.get(key).push(entity);
    }

    // 내 주변(3x3 셀)에 있는 유닛들만 가져오기
    retrieve(entity) {
        const results = [];
        const col = Math.floor(entity.x / this.cellSize);
        const row = Math.floor(entity.y / this.cellSize);

        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                const key = `${col + i},${row + j}`;
                if (this.buckets.has(key)) {
                    const bucket = this.buckets.get(key);
                    for (let k = 0; k < bucket.length; k++) {
                        results.push(bucket[k]);
                    }
                }
            }
        }
        return results;
    }
}
