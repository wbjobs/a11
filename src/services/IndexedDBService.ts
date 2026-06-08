import { openDB, IDBPDatabase, DBSchema } from 'idb';
import type { IDBPTransaction, StoreNames } from 'idb';
import type {
  Room,
  PointCloudVersion,
  PointCloudData,
  Annotation,
} from 'shared/types';

interface PointCloudVersionStore extends PointCloudVersion {}

interface PointCloudDataStore {
  versionId: string;
  roomId: string;
  timestamp: number;
  versionNumber: number;
  points: number[];
  colors: number[];
  pointCount: number;
  cameraPoses?: Array<{
    cameraId: string;
    position: [number, number, number];
    rotation: [number, number, number, number];
    focalLength: number;
  }>;
}

interface AnnotationStore extends Annotation {}

interface LocalFrameStore {
  frameId: string;
  roomId: string;
  timestamp: number;
  imageData: string;
  cameraPose?: {
    position: [number, number, number];
    rotation: [number, number, number, number];
  };
}

interface PointCloudReconstructionDBSchema extends DBSchema {
  roomInfo: {
    key: string;
    value: Room;
    indexes: {
      createdAt: number;
    };
  };
  pointCloudVersions: {
    key: string;
    value: PointCloudVersionStore;
    indexes: {
      roomId: string;
      timestamp: number;
      versionNumber: number;
    };
  };
  pointCloudData: {
    key: string;
    value: PointCloudDataStore;
    indexes: {
      roomId: string;
    };
  };
  annotations: {
    key: string;
    value: AnnotationStore;
    indexes: {
      roomId: string;
      versionId: string;
      userId: string;
      createdAt: number;
    };
  };
  localFrames: {
    key: string;
    value: LocalFrameStore;
    indexes: {
      roomId: string;
      timestamp: number;
    };
  };
}

type DBInstance = IDBPDatabase<PointCloudReconstructionDBSchema>;

const DB_NAME = 'PointCloudReconstructionDB';
const DB_VERSION = 1;

class IndexedDBService {
  private dbPromise: Promise<DBInstance> | null = null;

  public async openDB(): Promise<DBInstance> {
    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = openDB<PointCloudReconstructionDBSchema>(DB_NAME, DB_VERSION, {
      upgrade: (
        db: IDBPDatabase<PointCloudReconstructionDBSchema>,
        oldVersion: number,
        _newVersion: number | null,
        _transaction: IDBPTransaction<PointCloudReconstructionDBSchema, StoreNames<PointCloudReconstructionDBSchema>[], 'versionchange'>
      ) => {
        if (oldVersion < 1) {
          const roomInfoStore = db.createObjectStore('roomInfo', {
            keyPath: 'roomId',
          });
          roomInfoStore.createIndex('createdAt', 'createdAt');

          const versionsStore = db.createObjectStore('pointCloudVersions', {
            keyPath: 'versionId',
          });
          versionsStore.createIndex('roomId', 'roomId');
          versionsStore.createIndex('timestamp', 'timestamp');
          versionsStore.createIndex('versionNumber', 'versionNumber');

          const dataStore = db.createObjectStore('pointCloudData', {
            keyPath: 'versionId',
          });
          dataStore.createIndex('roomId', 'roomId');

          const annotationsStore = db.createObjectStore('annotations', {
            keyPath: 'annotationId',
          });
          annotationsStore.createIndex('roomId', 'roomId');
          annotationsStore.createIndex('versionId', 'pointCloudVersionId');
          annotationsStore.createIndex('userId', 'userId');
          annotationsStore.createIndex('createdAt', 'createdAt');

          const framesStore = db.createObjectStore('localFrames', {
            keyPath: 'frameId',
          });
          framesStore.createIndex('roomId', 'roomId');
          framesStore.createIndex('timestamp', 'timestamp');
        }
      },
    });

    return this.dbPromise;
  }

  public async saveRoomInfo(room: Room): Promise<void> {
    const db = await this.openDB();
    await db.put('roomInfo', room);
  }

  public async getRoomInfo(roomId: string): Promise<Room | undefined> {
    const db = await this.openDB();
    return db.get('roomInfo', roomId);
  }

  public async savePointCloudVersion(version: PointCloudVersion): Promise<void> {
    const db = await this.openDB();
    await db.put('pointCloudVersions', version);
  }

  public async savePointCloudData(
    versionId: string,
    roomId: string,
    points: number[],
    colors: number[],
    versionNumber: number
  ): Promise<void> {
    const db = await this.openDB();
    const data: PointCloudDataStore = {
      versionId,
      roomId,
      points,
      colors,
      versionNumber,
      pointCount: points.length / 3,
      timestamp: Date.now(),
    };
    await db.put('pointCloudData', data);
  }

  public async getPointCloudVersion(
    versionId: string
  ): Promise<PointCloudVersion | undefined> {
    const db = await this.openDB();
    return db.get('pointCloudVersions', versionId);
  }

  public async getPointCloudVersions(
    roomId: string
  ): Promise<PointCloudVersion[]> {
    const db = await this.openDB();
    const versions = await db.getAllFromIndex(
      'pointCloudVersions',
      'roomId',
      roomId
    );
    return versions.sort((a, b) => b.versionNumber - a.versionNumber);
  }

  public async getLatestPointCloud(
    roomId: string
  ): Promise<PointCloudData | null> {
    const db = await this.openDB();
    const versions = await db.getAllFromIndex(
      'pointCloudVersions',
      'roomId',
      roomId
    );

    if (versions.length === 0) {
      return null;
    }

    const latestVersion = versions.sort(
      (a, b) => b.versionNumber - a.versionNumber
    )[0];

    const data = await db.get('pointCloudData', latestVersion.versionId);
    if (!data) {
      return null;
    }

    return {
      versionId: data.versionId,
      roomId: data.roomId,
      timestamp: data.timestamp,
      versionNumber: data.versionNumber,
      points: data.points,
      colors: data.colors,
      pointCount: data.pointCount,
      cameraPoses: data.cameraPoses,
    };
  }

  public async getPointCloudData(
    versionId: string
  ): Promise<PointCloudData | undefined> {
    const db = await this.openDB();
    const data = await db.get('pointCloudData', versionId);
    if (!data) return undefined;

    return {
      versionId: data.versionId,
      roomId: data.roomId,
      timestamp: data.timestamp,
      versionNumber: data.versionNumber,
      points: data.points,
      colors: data.colors,
      pointCount: data.pointCount,
      cameraPoses: data.cameraPoses,
    };
  }

  public async saveAnnotation(annotation: Annotation): Promise<void> {
    const db = await this.openDB();
    await db.put('annotations', annotation);
  }

  public async updateAnnotation(annotation: Annotation): Promise<void> {
    const db = await this.openDB();
    const existing = await db.get('annotations', annotation.annotationId);
    if (!existing) {
      throw new Error(`Annotation ${annotation.annotationId} not found`);
    }
    await db.put('annotations', {
      ...annotation,
      updatedAt: Date.now(),
    });
  }

  public async deleteAnnotation(annotationId: string): Promise<void> {
    const db = await this.openDB();
    await db.delete('annotations', annotationId);
  }

  public async getAnnotations(
    roomId: string,
    versionId?: string
  ): Promise<Annotation[]> {
    const db = await this.openDB();

    if (versionId) {
      return db.getAllFromIndex('annotations', 'versionId', versionId);
    }

    const allAnnotations = await db.getAllFromIndex(
      'annotations',
      'roomId',
      roomId
    );
    return allAnnotations.sort((a, b) => a.createdAt - b.createdAt);
  }

  public async saveFrame(frameData: LocalFrameStore): Promise<void> {
    const db = await this.openDB();
    await db.put('localFrames', frameData);
  }

  public async getFrames(roomId: string): Promise<LocalFrameStore[]> {
    const db = await this.openDB();
    const frames = await db.getAllFromIndex('localFrames', 'roomId', roomId);
    return frames.sort((a, b) => a.timestamp - b.timestamp);
  }

  public async clearRoomData(roomId: string): Promise<void> {
    const db = await this.openDB();
    const tx = db.transaction(
      ['pointCloudVersions', 'pointCloudData', 'annotations', 'localFrames'],
      'readwrite'
    );

    let versionCursor = await tx.objectStore('pointCloudVersions')
      .index('roomId')
      .openCursor(IDBKeyRange.only(roomId));
    while (versionCursor) {
      await versionCursor.delete();
      versionCursor = await versionCursor.continue();
    }

    let dataCursor = await tx.objectStore('pointCloudData')
      .index('roomId')
      .openCursor(IDBKeyRange.only(roomId));
    while (dataCursor) {
      await dataCursor.delete();
      dataCursor = await dataCursor.continue();
    }

    let annotationCursor = await tx.objectStore('annotations')
      .index('roomId')
      .openCursor(IDBKeyRange.only(roomId));
    while (annotationCursor) {
      await annotationCursor.delete();
      annotationCursor = await annotationCursor.continue();
    }

    let frameCursor = await tx.objectStore('localFrames')
      .index('roomId')
      .openCursor(IDBKeyRange.only(roomId));
    while (frameCursor) {
      await frameCursor.delete();
      frameCursor = await frameCursor.continue();
    }

    await tx.done;
  }

  public async exportRoomData(roomId: string): Promise<{
    roomInfo?: Room;
    pointCloudVersions: PointCloudVersion[];
    pointCloudData: PointCloudData[];
    annotations: Annotation[];
    frames: LocalFrameStore[];
  }> {
    const db = await this.openDB();

    const roomInfo = await db.get('roomInfo', roomId);
    const pointCloudVersions = await db.getAllFromIndex(
      'pointCloudVersions',
      'roomId',
      roomId
    );

    const versionIds = pointCloudVersions.map((v) => v.versionId);
    const pointCloudData: PointCloudData[] = [];
    for (const versionId of versionIds) {
      const data = await db.get('pointCloudData', versionId);
      if (data) {
        pointCloudData.push({
          versionId: data.versionId,
          roomId: data.roomId,
          timestamp: data.timestamp,
          versionNumber: data.versionNumber,
          points: data.points,
          colors: data.colors,
          pointCount: data.pointCount,
          cameraPoses: data.cameraPoses,
        });
      }
    }

    const annotations = await db.getAllFromIndex(
      'annotations',
      'roomId',
      roomId
    );
    const frames = await db.getAllFromIndex('localFrames', 'roomId', roomId);

    return {
      roomInfo,
      pointCloudVersions: pointCloudVersions.sort(
        (a, b) => a.versionNumber - b.versionNumber
      ),
      pointCloudData: pointCloudData.sort(
        (a, b) => a.versionNumber - b.versionNumber
      ),
      annotations: annotations.sort((a, b) => a.createdAt - b.createdAt),
      frames: frames.sort((a, b) => a.timestamp - b.timestamp),
    };
  }

  public async closeDB(): Promise<void> {
    if (this.dbPromise) {
      const db = await this.dbPromise;
      db.close();
      this.dbPromise = null;
    }
  }

  public async deleteDB(): Promise<void> {
    await this.closeDB();
    const { deleteDB: idbDeleteDB } = await import('idb');
    await idbDeleteDB(DB_NAME);
  }
}

export const indexedDBService = new IndexedDBService();
export default IndexedDBService;
