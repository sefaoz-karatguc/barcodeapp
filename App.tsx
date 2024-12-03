import { Camera, CameraView } from "expo-camera";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Button,
  Dimensions,
  Image,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import * as MediaLibrary from "expo-media-library";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";

export default function App() {
  const { height, width } = useWindowDimensions();
  const [currentView, setCurrentView] = useState<"camera" | "save" | "login">(
    "login"
  );
  const [loading, setLoading] = useState(false);
  const [scanResult, setScanResult] = useState("");
  const [email, setEmail] = useState("");
  const [captchaValue, setCaptchaValue] = useState("");
  const [password, setPassword] = useState("");
  const [image, setImage] = useState<any>();
  const [token, setToken] = useState<undefined | string>(undefined);
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [captchaImage, setCaptchaImage] = useState<string | undefined>(
    undefined
  );
  const [cameraRef, setCameraRef] = useState<CameraView>();
  useEffect(() => {
    const requestPermission = async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      await MediaLibrary.requestPermissionsAsync();
      setHasPermission(status === "granted");
    };
    requestPermission();
  }, []);

  const takePicture = async () => {
    if (cameraRef) {
      try {
        const takenPicturePromise = cameraRef.takePictureAsync({
          quality: 0.8,
        });

        if (Boolean(takenPicturePromise)) {
          const data = await takenPicturePromise;
          const takenPicture = await MediaLibrary.createAssetAsync(data!.uri);
          console.log("takenPicture: ", takenPicture);
          if (Platform.OS === "ios") {
            const assetInfo = await MediaLibrary.getAssetInfoAsync(
              takenPicture.id
            );
            console.log("assetInfo: ", assetInfo);

            setImage(assetInfo);
          } else {
            setImage(takenPicture);
          }
        }
      } catch (error) {}
    }
  };
  const saveScanned = async () => {
    try {
      if (!image || !scanResult) {
        Alert.alert("Fotoğraf ve barkod sonucu zorunlu");
        return;
      }
      const form = new FormData();
      form.append("metafile", {
        uri: Platform.OS === "android" ? image.uri : image.localUri, // Use the `uri` from the image picker
        name: image.filename, // A default name for the image
        type: "image/jpg", // Ensure type is set, e.g., "image/jpeg"
      } as any);
      form.append("barcode", scanResult);
      const result = await axios.post(
        "https://digitalnextservice.karatguc.com/api/Accounting/SaveScannedBarcode",
        form,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      console.log("result: ", result.data);

      if (result.data.isSuccess) {
        Alert.alert("Kaydedildi!");
        setScanResult("");
        setImage(undefined);
        setCurrentView("camera");
      } else {
        Alert.alert(result.data.message);
      }
    } catch (error) {
      Alert.alert("Hata!!");
    }
  };

  const getSerial = async (captcha: string) => {
    const saved = await AsyncStorage.getItem("sessionId");
    const sessionId = JSON.parse(saved!);
    return {
      id: sessionId.id,
      captcha,
    };
  };
  useEffect(() => {
    if (scanResult && image) {
      setCurrentView("save");
    }
  }, [image, scanResult]);

  const handleLogin = async () => {
    if (!email || !password || !captchaValue) {
      Alert.alert("Bütün alanların doldurulması zorunludur!");
      return;
    }
    setLoading(true);
    const sessionInfo = await getSerial(captchaValue);
    try {
      const body = {
        username: email,
        password,
        serial: sessionInfo,
      };
      console.log("body: ", body);

      const result = await axios.post(
        "https://digitalnextservice.karatguc.com/api/login/GetToken",
        body
      );
      console.log("result: ", result);
      if (result.data.isSuccess) {
        setToken(result.data.result.token);
        setCurrentView("camera");
      }
    } catch (error) {
      Alert.alert("Captcha veya kullanıcı bilgileri yanlış!");
    }
    setLoading(false);
  };
  function generateRandomString(length: number) {
    return Math.random()
      .toString(36)
      .substring(2, 2 + length);
  }
  const getCaptcha = async () => {
    try {
      const randomSession = generateRandomString(6);
      const response = await axios.post(
        "https://digitalnextservice.karatguc.com/api/login/GetCaptcha",
        {
          id: randomSession,
        }
      );
      await AsyncStorage.setItem(
        "sessionId",
        JSON.stringify({ id: `KaratNext_${response.data.sessionId}` })
      );
      setCaptchaImage(response.data.captchaImage);
    } catch (error: any) {
      return {
        data: undefined,
        message: error.message,
        isSuccess: false,
      };
    }
  };
  useEffect(() => {
    getCaptcha();
  }, []);

  return (
    <View style={styles.container}>
      {currentView === "login" && (
        <View
          style={{
            width: width * 0.7,
            rowGap: 10,
          }}
        >
          <Text style={{ textAlign: "center" }}>
            Envanter Sayım Uygulamasına Giriş için Digital Uygulamasındaki
            Kullanıcı Bilgilerinizi Kullanabilirsiniz
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Email"
            keyboardType="email-address"
            inputMode="email"
            onChangeText={setEmail}
          />
          <TextInput
            placeholder="Password"
            style={styles.input}
            keyboardType="default"
            inputMode="text"
            secureTextEntry
            onChangeText={setPassword}
          />
          <TextInput
            placeholder="Captcha"
            style={styles.input}
            keyboardType="default"
            inputMode="text"
            onChangeText={setCaptchaValue}
          />
          {captchaImage && (
            <View style={{ width: "auto", height: 100 }}>
              <Image
                source={{ uri: `data:image/jpeg;base64,${captchaImage}` }}
                style={{ width: "100%", height: "100%" }}
                resizeMode="contain"
              />
            </View>
          )}
          <Button
            title={loading ? "Giriş Yapılıyor..." : "Giriş Yap"}
            onPress={handleLogin}
          />
        </View>
      )}
      {hasPermission && currentView === "camera" && (
        <>
          <CameraView
            style={{
              height,
              width,
            }}
            barcodeScannerSettings={{
              barcodeTypes: ["qr"],
            }}
            ref={(ref) => setCameraRef(ref ?? undefined)}
            mode="picture"
            facing="back"
            onBarcodeScanned={(event) => {
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success
              );
              setScanResult(event.data);
            }}
          />
          <TouchableOpacity style={styles.photoTaker} onPress={takePicture}>
            <Text>Fotoğraf Çek</Text>
          </TouchableOpacity>
        </>
      )}
      {currentView === "save" && (
        <View style={{ alignItems: "center", justifyContent: "center" }}>
          <Image
            source={{
              uri: Platform.OS === "android" ? image.uri : image.localUri,
            }}
            style={{ width: width * 0.5, height: height * 0.5 }}
            resizeMode="contain"
          />
          <Text style={{ fontWeight: "700", fontSize: 20 }}>
            Son Okunan Değer: {scanResult}
          </Text>
          <Button
            title={loading ? "Kaydediliyor" : "Kaydet"}
            disabled={loading}
            onPress={saveScanned}
          />
          <View style={{ height: 10 }} />
          <Button
            title={"Tekrar Çek"}
            disabled={loading}
            onPress={() => {
              setCurrentView("camera");
              setScanResult("");
              setImage(undefined);
            }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    borderWidth: 1,
    borderRadius: 6,
    borderColor: "black",
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === "ios" ? 5 : 1,
  },
  photoTaker: {
    position: "absolute",
    bottom: 50,
    alignSelf: "center",
    backgroundColor: "white",
    padding: 5,
    borderRadius: 10,
  },
});
