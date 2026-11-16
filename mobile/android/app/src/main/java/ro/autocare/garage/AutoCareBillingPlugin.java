package ro.autocare.garage;

import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.android.billingclient.api.*;
import java.util.*;

@CapacitorPlugin(name="AutoCareBilling")
public class AutoCareBillingPlugin extends Plugin implements PurchasesUpdatedListener {
 private BillingClient client;
 private PluginCall pending;
 @Override public void load(){
  client=BillingClient.newBuilder(getContext()).setListener(this)
   .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
   .enableAutoServiceReconnection().build();
 }
 private void connected(PluginCall call,Runnable action){
  if(client.isReady()){action.run();return;}
  client.startConnection(new BillingClientStateListener(){
   public void onBillingSetupFinished(BillingResult result){if(result.getResponseCode()==BillingClient.BillingResponseCode.OK)action.run();else call.reject("Google Play Billing indisponibil.");}
   public void onBillingServiceDisconnected(){}
  });
 }
 @PluginMethod public void purchase(PluginCall call){
  if(pending!=null){call.reject("O achiziție este deja în curs.");return;}
  String product=call.getString("productId"),account=call.getString("accountId");
  if(product==null||account==null||!account.matches("[a-f0-9]{64}")){call.reject("Plan invalid.");return;}
  connected(call,()->{
   QueryProductDetailsParams params=QueryProductDetailsParams.newBuilder().setProductList(Collections.singletonList(
    QueryProductDetailsParams.Product.newBuilder().setProductId(product).setProductType(BillingClient.ProductType.SUBS).build())).build();
   client.queryProductDetailsAsync(params,(result,details)->{
    if(result.getResponseCode()!=BillingClient.BillingResponseCode.OK||details.getProductDetailsList().isEmpty()){call.reject("Planul nu este disponibil în Google Play.");return;}
    ProductDetails item=details.getProductDetailsList().get(0);
    List<ProductDetails.SubscriptionOfferDetails> offers=item.getSubscriptionOfferDetails();
    if(offers==null||offers.isEmpty()){call.reject("Abonament indisponibil.");return;}
    // Standard base plan only: no accidental trial or introductory offer selection.
    ProductDetails.SubscriptionOfferDetails offer=null;
    for(ProductDetails.SubscriptionOfferDetails candidate:offers)if(candidate.getOfferId()==null){offer=candidate;break;}
    if(offer==null){call.reject("Planul standard nu este configurat.");return;}
    BillingFlowParams flow=BillingFlowParams.newBuilder().setObfuscatedAccountId(account)
     .setProductDetailsParamsList(Collections.singletonList(BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(item).setOfferToken(offer.getOfferToken()).build())).build();
    getActivity().runOnUiThread(()->{
     pending=call;
     BillingResult launched=client.launchBillingFlow(getActivity(),flow);
     if(launched.getResponseCode()!=BillingClient.BillingResponseCode.OK){pending=null;call.reject("Nu s-a putut deschide Google Play.");}
    });
   });
  });
 }
 private JSArray serialized(List<Purchase> purchases){
  JSArray rows=new JSArray();
  if(purchases!=null)for(Purchase purchase:purchases){
   JSObject row=new JSObject();row.put("token",purchase.getPurchaseToken());row.put("purchased",purchase.getPurchaseState()==Purchase.PurchaseState.PURCHASED);rows.put(row);
  }
  return rows;
 }
 @Override public void onPurchasesUpdated(BillingResult result,List<Purchase> purchases){
  PluginCall call=pending;pending=null;
  if(call==null)return;
  if(result.getResponseCode()==BillingClient.BillingResponseCode.USER_CANCELED){call.resolve(new JSObject().put("cancelled",true));return;}
  if(result.getResponseCode()!=BillingClient.BillingResponseCode.OK){call.reject("Plata Google Play nu a fost finalizată.");return;}
  call.resolve(new JSObject().put("purchases",serialized(purchases)));
 }
 @PluginMethod public void restore(PluginCall call){
  connected(call,()->client.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build(),(result,items)->{
   if(result.getResponseCode()!=BillingClient.BillingResponseCode.OK){call.reject("Restaurarea Google Play nu a reușit.");return;}
   call.resolve(new JSObject().put("purchases",serialized(items)));
  }));
 }
 @Override protected void handleOnDestroy(){if(client!=null)client.endConnection();super.handleOnDestroy();}
}
