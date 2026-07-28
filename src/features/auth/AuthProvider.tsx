import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  getIdTokenResult,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { friendlyFirebaseError } from "../../lib/firebase/errors";
import { useFirebase } from "../live/FirebaseProvider";
import {
  reauthenticateSpecialRevealOrganizer,
  type RecentRevealAuthorization,
} from "./specialRevealAuthorization";

type GuestAuthState =
  | { status: "unconfigured" | "loading"; uid: null; message: null }
  | { status: "ready"; uid: string; message: null }
  | { status: "error"; uid: null; message: string };

type OrganizerAuthState =
  | {
      status: "unconfigured" | "signed-out" | "checking";
      uid: null;
      message: null;
    }
  | {
      status: "authorized";
      uid: string;
      email: string;
      specialRevealAdmin: boolean;
      authTimeMs: number;
      message: null;
    }
  | { status: "error"; uid: null; message: string };

interface AuthContextValue {
  guest: GuestAuthState;
  organizer: OrganizerAuthState;
  signInOrganizer: (email: string, password: string) => Promise<void>;
  signOutOrganizer: () => Promise<void>;
  reauthenticateSpecialReveal: (
    password: string,
  ) => Promise<RecentRevealAuthorization>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const firebase = useFirebase();
  const [guest, setGuest] = useState<GuestAuthState>(() =>
    firebase.status === "ready"
      ? { status: "loading", uid: null, message: null }
      : { status: "unconfigured", uid: null, message: null },
  );
  const [organizer, setOrganizer] = useState<OrganizerAuthState>(() =>
    firebase.status === "ready"
      ? { status: "checking", uid: null, message: null }
      : { status: "unconfigured", uid: null, message: null },
  );

  useEffect(() => {
    if (firebase.status !== "ready") return;
    let active = true;
    let anonymousSignInStarted = false;

    void firebase.clients.persistenceReady.catch(() => undefined);
    const unsubscribe = onAuthStateChanged(
      firebase.clients.guestAuth,
      (user) => {
        if (!active) return;
        if (user?.isAnonymous) {
          setGuest({ status: "ready", uid: user.uid, message: null });
          return;
        }
        if (anonymousSignInStarted) return;
        anonymousSignInStarted = true;
        setGuest({ status: "loading", uid: null, message: null });
        void firebase.clients.persistenceReady
          .then(() => signInAnonymously(firebase.clients.guestAuth))
          .catch((error: unknown) => {
            if (!active) return;
            setGuest({
              status: "error",
              uid: null,
              message: friendlyFirebaseError(
                error,
                "Guest access could not start. The static trip page still works.",
              ),
            });
          });
      },
      (error) => {
        if (!active) return;
        setGuest({
          status: "error",
          uid: null,
          message: friendlyFirebaseError(error, "Guest access is unavailable."),
        });
      },
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [firebase]);

  useEffect(() => {
    if (firebase.status !== "ready") return;
    let active = true;

    const unsubscribe = onAuthStateChanged(
      firebase.clients.organizerAuth,
      (user) => {
        if (!active) return;
        if (!user) {
          setOrganizer({ status: "signed-out", uid: null, message: null });
          return;
        }

        setOrganizer({ status: "checking", uid: null, message: null });
        void getIdTokenResult(user, true)
          .then(async (token) => {
            if (!active) return;
            if (token.claims.admin === true) {
              setOrganizer({
                status: "authorized",
                uid: user.uid,
                email: user.email ?? "",
                specialRevealAdmin: token.claims.specialRevealAdmin === true,
                authTimeMs: Date.parse(token.authTime),
                message: null,
              });
              return;
            }
            await signOut(firebase.clients.organizerAuth);
            if (active) {
              setOrganizer({
                status: "error",
                uid: null,
                message: "This account does not have organizer access.",
              });
            }
          })
          .catch(async () => {
            await signOut(firebase.clients.organizerAuth).catch(
              () => undefined,
            );
            if (active) {
              setOrganizer({
                status: "error",
                uid: null,
                message: "Organizer access could not be verified.",
              });
            }
          });
      },
      () => {
        if (active) {
          setOrganizer({
            status: "error",
            uid: null,
            message: "Organizer sign-in is unavailable.",
          });
        }
      },
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [firebase]);

  const signInOrganizer = useCallback(
    async (email: string, password: string) => {
      if (firebase.status !== "ready") {
        throw new Error("Firebase is not configured");
      }
      setOrganizer({ status: "checking", uid: null, message: null });
      try {
        await firebase.clients.persistenceReady;
        const credential = await signInWithEmailAndPassword(
          firebase.clients.organizerAuth,
          email.trim(),
          password,
        );
        const token = await getIdTokenResult(credential.user, true);
        if (token.claims.admin !== true) {
          await signOut(firebase.clients.organizerAuth);
          throw new Error("not-admin");
        }
        setOrganizer({
          status: "authorized",
          uid: credential.user.uid,
          email: credential.user.email ?? email.trim(),
          specialRevealAdmin: token.claims.specialRevealAdmin === true,
          authTimeMs: Date.parse(token.authTime),
          message: null,
        });
      } catch (error) {
        const message =
          error instanceof Error && error.message === "not-admin"
            ? "This account does not have organizer access."
            : friendlyFirebaseError(error, "Organizer sign-in failed.");
        setOrganizer({ status: "error", uid: null, message });
        throw new Error(message, { cause: error });
      }
    },
    [firebase],
  );

  const signOutOrganizer = useCallback(async () => {
    if (firebase.status !== "ready") return;
    await signOut(firebase.clients.organizerAuth);
  }, [firebase]);

  const reauthenticateSpecialReveal = useCallback(
    async (password: string) => {
      if (firebase.status !== "ready")
        throw new Error("Firebase is not configured.");
      try {
        const authorization = await reauthenticateSpecialRevealOrganizer(
          firebase.clients.organizerAuth,
          password,
        );
        setOrganizer({
          status: "authorized",
          uid: authorization.uid,
          email: authorization.email,
          specialRevealAdmin: true,
          authTimeMs: authorization.authTimeMs,
          message: null,
        });
        return authorization;
      } catch (error) {
        throw new Error(
          friendlyFirebaseError(
            error,
            error instanceof Error
              ? error.message
              : "Organizer reauthentication failed.",
          ),
          { cause: error },
        );
      }
    },
    [firebase],
  );

  const value = useMemo(
    () => ({
      guest,
      organizer,
      signInOrganizer,
      signOutOrganizer,
      reauthenticateSpecialReveal,
    }),
    [
      guest,
      organizer,
      reauthenticateSpecialReveal,
      signInOrganizer,
      signOutOrganizer,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Hooks intentionally share this module with their provider.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
