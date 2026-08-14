export interface DatabaseReadiness {
  isReady(): Promise<boolean>;
}
